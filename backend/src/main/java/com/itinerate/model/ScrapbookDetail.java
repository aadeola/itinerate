package com.itinerate.model;

import java.time.Instant;
import java.util.List;

public record ScrapbookDetail(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt,
        List<ScrapbookImageResponse> images
) {}
