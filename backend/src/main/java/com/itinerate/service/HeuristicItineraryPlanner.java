package com.itinerate.service;

import com.itinerate.model.ActivityInput;
import com.itinerate.model.DayPlan;
import com.itinerate.model.Itinerary;
import com.itinerate.model.ScheduledActivity;
import com.itinerate.model.TripRequest;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deterministic, dependency-free planner. It clusters activities that share a
 * location, spreads them evenly across the available days, and lays each day out
 * inside the traveler's preferred time window.
 */
public class HeuristicItineraryPlanner implements ItineraryPlanner {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final int DEFAULT_DURATION_MINUTES = 90;
    private static final int TRAVEL_BUFFER_MINUTES = 30;

    @Override
    public Itinerary plan(TripRequest request) {
        List<ActivityInput> ordered = clusterByLocation(request.activities());
        List<List<ActivityInput>> buckets = distributeAcrossDays(ordered, request.days());

        LocalTime windowStart = LocalTime.parse(request.startTime(), TIME);
        LocalTime windowEnd = LocalTime.parse(request.endTime(), TIME);

        List<DayPlan> days = new ArrayList<>();
        for (int i = 0; i < buckets.size(); i++) {
            int dayNumber = i + 1;
            days.add(scheduleDay(dayNumber, buckets.get(i), windowStart, windowEnd));
        }

        String summary = "%d %s across %d %s in %s, from %s to %s.".formatted(
                request.activities().size(),
                request.activities().size() == 1 ? "activity" : "activities",
                days.size(),
                days.size() == 1 ? "day" : "days",
                request.city(),
                request.startTime(),
                request.endTime());

        return new Itinerary(request.city(), days, summary);
    }

    /** Groups activities so that ones sharing a location sit next to each other. */
    private List<ActivityInput> clusterByLocation(List<ActivityInput> activities) {
        Map<String, List<ActivityInput>> groups = new LinkedHashMap<>();
        for (ActivityInput activity : activities) {
            String key = locationKey(activity);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(activity);
        }
        List<ActivityInput> ordered = new ArrayList<>();
        groups.values().forEach(ordered::addAll);
        return ordered;
    }

    private String locationKey(ActivityInput activity) {
        if (activity.location() == null || activity.location().isBlank()) {
            return "";
        }
        return activity.location().trim().toLowerCase();
    }

    /** Splits the ordered activities into as-even-as-possible day buckets. */
    private List<List<ActivityInput>> distributeAcrossDays(List<ActivityInput> ordered, int days) {
        List<List<ActivityInput>> buckets = new ArrayList<>();
        int usableDays = Math.max(1, Math.min(days, Math.max(1, ordered.size())));
        for (int i = 0; i < usableDays; i++) {
            buckets.add(new ArrayList<>());
        }

        int total = ordered.size();
        int base = total / usableDays;
        int remainder = total % usableDays;

        int index = 0;
        for (int i = 0; i < usableDays; i++) {
            int count = base + (i < remainder ? 1 : 0);
            for (int j = 0; j < count && index < total; j++) {
                buckets.get(i).add(ordered.get(index++));
            }
        }
        return buckets;
    }

    private DayPlan scheduleDay(int dayNumber, List<ActivityInput> activities,
                                LocalTime windowStart, LocalTime windowEnd) {
        List<ScheduledActivity> items = new ArrayList<>();
        LocalTime cursor = windowStart;

        for (int i = 0; i < activities.size(); i++) {
            ActivityInput activity = activities.get(i);
            int duration = activity.durationMinutes() != null
                    ? activity.durationMinutes()
                    : DEFAULT_DURATION_MINUTES;

            LocalTime start = cursor;
            LocalTime end = start.plusMinutes(duration);

            items.add(new ScheduledActivity(
                    activity.name(),
                    activity.location(),
                    start.format(TIME),
                    end.format(TIME),
                    reasonFor(activity, i, dayNumber, end, windowEnd)));

            cursor = end.plusMinutes(TRAVEL_BUFFER_MINUTES);
        }

        return new DayPlan(dayNumber, items);
    }

    private String reasonFor(ActivityInput activity, int indexInDay, int dayNumber,
                             LocalTime end, LocalTime windowEnd) {
        boolean hasLocation = activity.location() != null && !activity.location().isBlank();
        if (indexInDay == 0) {
            return "Starts day %d%s.".formatted(
                    dayNumber,
                    hasLocation ? " around " + activity.location().trim() : "");
        }
        if (hasLocation) {
            return "Grouped near %s to cut down on travel.".formatted(activity.location().trim());
        }
        if (end.isAfter(windowEnd)) {
            return "Slotted late on day %d to fit everything in.".formatted(dayNumber);
        }
        return "Scheduled on day %d to keep the pace balanced.".formatted(dayNumber);
    }
}
