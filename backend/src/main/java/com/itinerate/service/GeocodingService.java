package com.itinerate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinerate.config.GeocodingProperties;
import com.itinerate.model.DayPlan;
import com.itinerate.model.GeocodedDayPlan;
import com.itinerate.model.GeocodedItinerary;
import com.itinerate.model.GeocodedScheduledActivity;
import com.itinerate.model.Itinerary;
import com.itinerate.model.ScheduledActivity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Service
public class GeocodingService {

    private static final Logger log = LoggerFactory.getLogger(GeocodingService.class);

    private final GeocodingProperties properties;
    private final RestClient restClient;

    public GeocodingService(GeocodingProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder().build();
    }

    public GeocodedItinerary geocode(Itinerary itinerary) {
        if (!properties.isEnabled()) {
            throw PlannerException.geocodingNotConfigured();
        }

        List<GeocodedDayPlan> days = new ArrayList<>();
        String firstGoogleError = null;
        for (DayPlan day : itinerary.days()) {
            List<GeocodedScheduledActivity> items = new ArrayList<>();
            for (ScheduledActivity item : day.items()) {
                GeocodeAttempt attempt = geocodeActivity(itinerary.city(), item);
                items.add(attempt.activity());
                if (firstGoogleError == null && attempt.googleError() != null) {
                    firstGoogleError = attempt.googleError();
                }
            }
            days.add(new GeocodedDayPlan(day.dayNumber(), items));
        }

        long mappedCount = days.stream()
                .flatMap(d -> d.items().stream())
                .filter(i -> i.latitude() != null && i.longitude() != null)
                .count();

        String geocodingError = mappedCount == 0 && firstGoogleError != null
                ? userFacingGeocodingError(firstGoogleError)
                : null;

        return new GeocodedItinerary(itinerary.city(), days, itinerary.summary(), geocodingError);
    }

    private record GeocodeAttempt(GeocodedScheduledActivity activity, String googleError) {
    }

    private String userFacingGeocodingError(String googleError) {
        String lower = googleError.toLowerCase();
        if (lower.contains("billing")) {
            return "Google Maps geocoding requires a billing account on your Google Cloud project "
                    + "(even for the free $200/month Maps credit). Enable billing at console.cloud.google.com, "
                    + "turn on the Geocoding API, then restart the backend.";
        }
        if (lower.contains("api key") || lower.contains("expired") || lower.contains("referer")) {
            return "Google Maps geocoding rejected the API key. Check ITINERARY_GEOCODING_API_KEY in backend/.env "
                    + "and confirm the Geocoding API is enabled.";
        }
        return "Google Maps geocoding failed: " + googleError;
    }

    private GeocodeAttempt geocodeActivity(String city, ScheduledActivity activity) {
        String query = buildQuery(city, activity);
        if (query.isBlank()) {
            return new GeocodeAttempt(GeocodedScheduledActivity.from(activity, null, null), null);
        }

        try {
            // Geocoding API v4: address is a URL path segment, auth via X-Goog-Api-Key header.
            URI uri = UriComponentsBuilder.fromHttpUrl(properties.getBaseUrl())
                    .pathSegment("address", query)
                    .build()
                    .encode()
                    .toUri();

            JsonNode response = restClient.get()
                    .uri(uri)
                    .header("X-Goog-Api-Key", properties.getApiKey())
                    .header("X-Goog-FieldMask", "results.location,results.formattedAddress")
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return new GeocodeAttempt(GeocodedScheduledActivity.from(activity, null, null), null);
            }

            JsonNode location = response.path("results").path(0).path("location");
            if (location.isMissingNode()) {
                return new GeocodeAttempt(GeocodedScheduledActivity.from(activity, null, null), null);
            }

            double lat = location.path("latitude").asDouble(Double.NaN);
            double lng = location.path("longitude").asDouble(Double.NaN);
            if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
                return new GeocodeAttempt(GeocodedScheduledActivity.from(activity, null, null), null);
            }

            return new GeocodeAttempt(GeocodedScheduledActivity.from(activity, lat, lng), null);
        } catch (RestClientResponseException e) {
            String message = parseV4ErrorMessage(e.getResponseBodyAsString());
            log.warn("Geocoding v4 HTTP {} for query '{}': {}",
                    e.getStatusCode().value(), query, message);
            return new GeocodeAttempt(
                    GeocodedScheduledActivity.from(activity, null, null),
                    message != null ? message : "HTTP " + e.getStatusCode().value());
        } catch (RestClientException e) {
            log.warn("Geocoding request failed for query '{}': {}", query, e.getMessage());
            return new GeocodeAttempt(
                    GeocodedScheduledActivity.from(activity, null, null),
                    e.getMessage());
        }
    }

    private String parseV4ErrorMessage(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode message = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(body).path("error").path("message");
            return message.isMissingNode() || message.asText().isBlank() ? null : message.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private String buildQuery(String city, ScheduledActivity activity) {
        List<String> parts = new ArrayList<>();
        if (activity.name() != null && !activity.name().isBlank()) {
            parts.add(activity.name().trim());
        }
        if (activity.location() != null && !activity.location().isBlank()) {
            parts.add(activity.location().trim());
        }
        if (city != null && !city.isBlank()) {
            parts.add(city.trim());
        }
        return String.join(", ", parts);
    }
}
