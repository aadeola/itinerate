package com.itinerate.controller;

import com.itinerate.model.Itinerary;
import com.itinerate.model.TripRequest;
import com.itinerate.service.GeocodingService;
import com.itinerate.service.ItineraryPlanner;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/itinerary")
public class ItineraryController {

    private final ItineraryPlanner planner;
    private final GeocodingService geocodingService;

    public ItineraryController(ItineraryPlanner planner, GeocodingService geocodingService) {
        this.planner = planner;
        this.geocodingService = geocodingService;
    }

    @PostMapping("/plan")
    public Itinerary plan(@Valid @RequestBody TripRequest request) {
        Itinerary planned = planner.plan(request);
        String displayCity = geocodingService.inferCityFromItinerary(planned, request.city());
        return new Itinerary(displayCity, planned.days(), planned.summary());
    }
}
