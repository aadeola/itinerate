package com.itinerate.model;

import java.time.Instant;

public record ScrapbookSummary(
        Long id,
        String name,
        int imageCount,
        Instant createdAt,
        Instant updatedAt
) {}
