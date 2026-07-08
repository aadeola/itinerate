package com.itinerate.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Enables {@link ItineraryVisionProperties} for the screenshot-to-activity feature.
 */
@Configuration
@EnableConfigurationProperties(ItineraryVisionProperties.class)
public class VisionConfig {
}
