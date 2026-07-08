package com.itinerate.model;

/**
 * A real-world place resolved from an inferred location via the Google Maps MCP.
 * All fields are nullable: maps resolution is best-effort and may be unavailable.
 */
public record ResolvedPlace(
        String name,
        String address,
        Double latitude,
        Double longitude,
        String placeId,
        String mapsUrl
) {
}
