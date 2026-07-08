package com.itinerate.model;

/**
 * The activity and location a vision model inferred from an uploaded screenshot.
 * {@code locationQuery} is the free-text place/area to hand to a maps lookup;
 * {@code confidence} is the model's 0..1 self-reported certainty.
 */
public record InferredActivity(
        String name,
        String locationQuery,
        String description,
        Double confidence
) {
}
