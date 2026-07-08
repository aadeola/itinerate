package com.itinerate.model;

import java.util.List;

/** The full planned trip: the city, one plan per day, and an optional summary. */
public record Itinerary(
        String city,
        List<DayPlan> days,
        String summary
) {
}
