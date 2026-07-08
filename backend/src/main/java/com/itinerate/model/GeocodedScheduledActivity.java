package com.itinerate.model;

/**
 * A scheduled activity with optional coordinates resolved via geocoding.
 */
public record GeocodedScheduledActivity(
        String name,
        String location,
        String startTime,
        String endTime,
        String reason,
        Double latitude,
        Double longitude,
        String mapsUrl
) {
    public static GeocodedScheduledActivity from(ScheduledActivity activity, Double latitude, Double longitude) {
        String mapsUrl = null;
        if (latitude != null && longitude != null) {
            mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + latitude + "," + longitude;
        }
        return new GeocodedScheduledActivity(
                activity.name(),
                activity.location(),
                activity.startTime(),
                activity.endTime(),
                activity.reason(),
                latitude,
                longitude,
                mapsUrl);
    }
}
