package com.itinerate.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateScrapbookRequest(
        @NotBlank(message = "Scrapbook name is required")
        @Size(max = 120, message = "Scrapbook name must be at most 120 characters")
        String name
) {}
