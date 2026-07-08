package com.itinerate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for geocoding scheduled itinerary activities via the Google
 * Geocoding REST API ({@code itinerary.geocoding.*}).
 */
@ConfigurationProperties(prefix = "itinerary.geocoding")
public class GeocodingProperties {

    private String apiKey = "";
    private String baseUrl = "https://geocode.googleapis.com/v4/geocode";

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
}
