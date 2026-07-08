package com.itinerate.model;

import java.util.List;

/** One day of a geocoded itinerary. */
public record GeocodedDayPlan(
        int dayNumber,
        List<GeocodedScheduledActivity> items
) {
}
