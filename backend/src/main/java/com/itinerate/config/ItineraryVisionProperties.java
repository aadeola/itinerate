package com.itinerate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the screenshot-to-activity vision feature, bound from
 * {@code itinerary.vision.*}. Vision uses Google Gemini (Google AI Studio);
 * maps resolution is delegated to the llm-proxy at {@code maps-resolve-url}.
 */
@ConfigurationProperties(prefix = "itinerary.vision")
public class ItineraryVisionProperties {

    private String apiKey = "";
    private String baseUrl = "https://generativelanguage.googleapis.com";
    private String model = "gemini-2.0-flash";
    private String mapsResolveUrl = "http://localhost:8081/v1/maps/resolve";

    /** Minimum self-reported confidence required to accept an inferred location. */
    private double minConfidence = 0.35;

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

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getMapsResolveUrl() {
        return mapsResolveUrl;
    }

    public void setMapsResolveUrl(String mapsResolveUrl) {
        this.mapsResolveUrl = mapsResolveUrl;
    }

    public double getMinConfidence() {
        return minConfidence;
    }

    public void setMinConfidence(double minConfidence) {
        this.minConfidence = minConfidence;
    }
}
