package com.itinerate.model;

import java.time.Instant;

public record SavedItineraryDetail(
        Long id,
        Instant createdAt,
        Itinerary itinerary
) {}
