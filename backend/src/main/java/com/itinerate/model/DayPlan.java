package com.itinerate.model;

import java.util.List;

/** All activities scheduled for a single day of the trip, in order. */
public record DayPlan(
        int dayNumber,
        List<ScheduledActivity> items
) {
}
