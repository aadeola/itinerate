package com.itinerate.model;

/**
 * Result of inferring an activity from a screenshot: what the vision model saw
 * plus the maps-resolved place (which may be {@code null} if resolution failed).
 */
public record VisionInferResponse(
        InferredActivity activity,
        ResolvedPlace place
) {
}
