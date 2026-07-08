package com.itinerate.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * A single activity the traveler wants to do. Only the name is required; the rest
 * help the planner produce a better ordering.
 */
public record ActivityInput(
        @NotBlank(message = "Activity name is required")
        String name,

        String location,

        @Positive(message = "Duration must be a positive number of minutes")
        Integer durationMinutes,

        String notes
) {
}
