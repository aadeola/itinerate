package com.itinerate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration for the optional LLM-backed planner, bound from {@code itinerary.llm.*}. */
@ConfigurationProperties(prefix = "itinerary.llm")
public class ItineraryLlmProperties {

    private String apiKey = "";
    private String baseUrl = "https://api.openai.com/v1";
    private String model = "gpt-4o-mini";

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
}
