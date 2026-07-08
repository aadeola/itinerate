package com.itinerate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "itinerary.scrapbook")
public record ScrapbookProperties(
        String uploadDir,
        int maxFilesPerUpload,
        long maxFileSizeBytes
) {}
