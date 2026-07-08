package com.itinerate.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * The trip the traveler wants planned: which city, how many days, the daily time
 * window, and the activities to fit in.
 */
public record TripRequest(
        @NotBlank(message = "City is required")
        String city,

        @Min(value = 1, message = "Trip must be at least 1 day")
        @Max(value = 30, message = "Trip cannot exceed 30 days")
        int days,

        @NotBlank(message = "Start time is required")
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Start time must be in HH:mm format")
        String startTime,

        @NotBlank(message = "End time is required")
        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "End time must be in HH:mm format")
        String endTime,

        @NotEmpty(message = "Add at least one activity")
        @Valid
        List<ActivityInput> activities
) {
}
