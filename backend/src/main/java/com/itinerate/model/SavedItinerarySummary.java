package com.itinerate.model;

import java.time.Instant;

public record SavedItinerarySummary(
        Long id,
        String city,
        String summary,
        int dayCount,
        Instant createdAt
) {}
