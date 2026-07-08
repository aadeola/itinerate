package com.itinerate.model;

/**
 * An activity placed at a concrete time slot within a day, along with a short
 * explanation of why it was scheduled there.
 */
public record ScheduledActivity(
        String name,
        String location,
        String startTime,
        String endTime,
        String reason
) {
}
