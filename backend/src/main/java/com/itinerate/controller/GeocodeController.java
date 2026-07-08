package com.itinerate.controller;

import com.itinerate.model.GeocodedItinerary;
import com.itinerate.model.Itinerary;
import com.itinerate.service.GeocodingService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/itinerary")
public class GeocodeController {

    private final GeocodingService geocodingService;

    public GeocodeController(GeocodingService geocodingService) {
        this.geocodingService = geocodingService;
    }

    @PostMapping("/geocode")
    public GeocodedItinerary geocode(@RequestBody Itinerary itinerary) {
        return geocodingService.geocode(itinerary);
    }
}
