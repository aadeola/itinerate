package com.itinerate.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinerate.service.ItineraryPlanner;
import com.itinerate.service.LlmItineraryPlanner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires up the LLM-backed {@link ItineraryPlanner}. An API key is required at
 * request time; see {@link LlmItineraryPlanner}.
 */
@Configuration
@EnableConfigurationProperties(ItineraryLlmProperties.class)
public class PlannerConfig {

    private static final Logger log = LoggerFactory.getLogger(PlannerConfig.class);

    @Bean
    public ItineraryPlanner itineraryPlanner(ItineraryLlmProperties properties,
                                             ObjectMapper objectMapper) {
        if (!properties.isEnabled()) {
            log.warn(
                    "ITINERARY_LLM_API_KEY is not set. Itinerary planning will return 503 until configured.");
        } else {
            log.info("LLM itinerary planner enabled (model={}).", properties.getModel());
        }
        return new LlmItineraryPlanner(properties, objectMapper);
    }
}
