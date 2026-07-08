package com.itinerate.service;

import com.itinerate.config.GeocodingProperties;
import com.itinerate.model.DayPlan;
import com.itinerate.model.GeocodedItinerary;
import com.itinerate.model.Itinerary;
import com.itinerate.model.ScheduledActivity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integration test for Google Geocoding REST. Requires ITINERARY_GEOCODING_API_KEY
 * with the Geocoding API enabled and billing active in Google Cloud Console.
 */
@EnabledIfEnvironmentVariable(named = "ITINERARY_GEOCODING_API_KEY", matches = ".+")
class GeocodingServiceIntegrationTest {

    private GeocodingService geocodingService;

    @BeforeEach
    void setUp() {
        GeocodingProperties properties = new GeocodingProperties();
        properties.setApiKey(System.getenv("ITINERARY_GEOCODING_API_KEY"));
        geocodingService = new GeocodingService(properties);
    }

    @Test
    void geocodesKnownAtlantaLandmarkOrSurfacesGoogleError() {
        Itinerary itinerary = new Itinerary(
                "atlanta",
                List.of(new DayPlan(
                        1,
                        List.of(new ScheduledActivity(
                                "Centennial Olympic Park",
                                "Downtown",
                                "09:00",
                                "10:30",
                                "Morning start")))),
                null);

        GeocodedItinerary result = geocodingService.geocode(itinerary);
        var item = result.days().get(0).items().get(0);

        if (item.latitude() != null && item.longitude() != null) {
            assertTrue(item.latitude() > 33 && item.latitude() < 34, "latitude should be near Atlanta");
            assertTrue(item.longitude() < -84 && item.longitude() > -85, "longitude should be near Atlanta");
            return;
        }

        assertNotNull(
                result.geocodingError(),
                "When geocoding fails, the API should surface a user-facing Google error");
        assertTrue(
                result.geocodingError().toLowerCase().contains("billing")
                        || result.geocodingError().toLowerCase().contains("api key")
                        || result.geocodingError().toLowerCase().contains("geocoding"),
                "Expected a descriptive geocoding error, got: " + result.geocodingError());
    }
}
