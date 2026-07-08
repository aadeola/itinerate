package com.itinerate.model;

import java.util.List;

/** An itinerary with optional coordinates on each scheduled activity. */
public record GeocodedItinerary(
        String city,
        List<GeocodedDayPlan> days,
        String summary,
        String geocodingError
) {
}
