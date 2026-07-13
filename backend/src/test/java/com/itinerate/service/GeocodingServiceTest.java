package com.itinerate.service;

import com.itinerate.config.GeocodingProperties;
import com.itinerate.model.DayPlan;
import com.itinerate.model.Itinerary;
import com.itinerate.model.ScheduledActivity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GeocodingServiceTest {

    private GeocodingService geocodingService;

    @BeforeEach
    void setUp() {
        geocodingService = new GeocodingService(new GeocodingProperties());
    }

    @Test
    void inferCityFromItineraryTrustsPlannerCity() {
        Itinerary itinerary = itineraryWithCity("Atlanta");
        assertEquals("Atlanta", geocodingService.inferCityFromItinerary(itinerary, "alanta"));
    }

    @Test
    void inferCityFromItineraryTitleCasesPlannerCity() {
        Itinerary itinerary = itineraryWithCity("mexico city");
        assertEquals("Mexico City", geocodingService.inferCityFromItinerary(itinerary, "mexco city"));
    }

    @Test
    void inferCityFromItineraryFallsBackToTypedCityWhenPlannerCityBlank() {
        Itinerary itinerary = itineraryWithCity("  ");
        assertEquals("New Delhi", geocodingService.inferCityFromItinerary(itinerary, "new delhi"));
    }

    @Test
    void inferCityFromItineraryFallsBackToTypedCityWhenItineraryNull() {
        assertEquals("Paris", geocodingService.inferCityFromItinerary(null, "paris"));
    }

    private Itinerary itineraryWithCity(String city) {
        return new Itinerary(
                city,
                List.of(new DayPlan(1, List.of(
                        new ScheduledActivity(
                                "CNN Center",
                                "Downtown Atlanta",
                                "09:00",
                                "11:00",
                                "Morning tour")))),
                "Three-day Atlanta itinerary with a downtown CNN Center studio tour on day one.");
    }
}
