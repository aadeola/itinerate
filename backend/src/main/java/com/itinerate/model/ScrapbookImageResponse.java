package com.itinerate.model;

import java.time.Instant;

public record ScrapbookImageResponse(
        Long id,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        int sortOrder,
        Instant createdAt,
        String contentUrl
) {}
