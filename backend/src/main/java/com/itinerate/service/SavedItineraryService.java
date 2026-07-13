package com.itinerate.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinerate.entity.SavedItinerary;
import com.itinerate.model.Itinerary;
import com.itinerate.model.SavedItineraryDetail;
import com.itinerate.model.SavedItinerarySummary;
import com.itinerate.repository.SavedItineraryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class SavedItineraryService {

    private static final Logger log = LoggerFactory.getLogger(SavedItineraryService.class);

    private final SavedItineraryRepository repository;
    private final ObjectMapper objectMapper;

    public SavedItineraryService(SavedItineraryRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SavedItinerarySummary> list() {
        List<SavedItinerarySummary> summaries = repository.findAll().stream()
                .sorted(Comparator.comparing(SavedItinerary::getCreatedAt).reversed())
                .map(this::toSummary)
                .toList();
        log.info("Listed {} saved itineraries.", summaries.size());
        return summaries;
    }

    @Transactional
    public SavedItinerarySummary save(Itinerary itinerary) {
        SavedItinerary entity = new SavedItinerary();
        entity.setCity(itinerary.city());
        entity.setSummary(itinerary.summary());
        entity.setDayCount(itinerary.days() == null ? 0 : itinerary.days().size());
        try {
            entity.setItineraryJson(objectMapper.writeValueAsString(itinerary));
        } catch (JsonProcessingException e) {
            throw SavedItineraryException.serializationFailed("Could not save the itinerary.", e);
        }
        SavedItinerarySummary summary = toSummary(repository.save(entity));
        log.info("Saved itinerary id={} for city='{}' ({} days).",
                summary.id(), summary.city(), summary.dayCount());
        return summary;
    }

    @Transactional(readOnly = true)
    public SavedItineraryDetail get(Long id) {
        log.info("Fetching saved itinerary id={}.", id);
        SavedItinerary entity = repository.findById(id)
                .orElseThrow(SavedItineraryException::notFound);
        Itinerary itinerary;
        try {
            itinerary = objectMapper.readValue(entity.getItineraryJson(), Itinerary.class);
        } catch (JsonProcessingException e) {
            throw SavedItineraryException.serializationFailed("Could not read the saved itinerary.", e);
        }
        return new SavedItineraryDetail(entity.getId(), entity.getCreatedAt(), itinerary);
    }

    @Transactional
    public void delete(Long id) {
        SavedItinerary entity = repository.findById(id)
                .orElseThrow(SavedItineraryException::notFound);
        repository.delete(entity);
        log.info("Deleted saved itinerary id={}.", id);
    }

    private SavedItinerarySummary toSummary(SavedItinerary entity) {
        return new SavedItinerarySummary(
                entity.getId(),
                entity.getCity(),
                entity.getSummary(),
                entity.getDayCount(),
                entity.getCreatedAt());
    }
}
