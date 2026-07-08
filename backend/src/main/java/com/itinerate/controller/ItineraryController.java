package com.itinerate.controller;

import com.itinerate.model.Itinerary;
import com.itinerate.model.TripRequest;
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

    public ItineraryController(ItineraryPlanner planner) {
        this.planner = planner;
    }

    @PostMapping("/plan")
    public Itinerary plan(@Valid @RequestBody TripRequest request) {
        return planner.plan(request);
    }
}
