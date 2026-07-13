package com.itinerate.controller;

import com.itinerate.model.Itinerary;
import com.itinerate.model.SavedItineraryDetail;
import com.itinerate.model.SavedItinerarySummary;
import com.itinerate.service.SavedItineraryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/saved-itineraries")
public class SavedItineraryController {

    private final SavedItineraryService savedItineraryService;

    public SavedItineraryController(SavedItineraryService savedItineraryService) {
        this.savedItineraryService = savedItineraryService;
    }

    @GetMapping
    public List<SavedItinerarySummary> list() {
        return savedItineraryService.list();
    }

    @PostMapping
    public SavedItinerarySummary save(@RequestBody Itinerary itinerary) {
        return savedItineraryService.save(itinerary);
    }

    @GetMapping("/{id}")
    public SavedItineraryDetail get(@PathVariable Long id) {
        return savedItineraryService.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        savedItineraryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
