package com.itinerate.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinerate.entity.SavedItinerary;
import com.itinerate.model.Itinerary;
import com.itinerate.model.SavedItineraryDetail;
import com.itinerate.model.SavedItinerarySummary;
import com.itinerate.repository.SavedItineraryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class SavedItineraryService {

    private final SavedItineraryRepository repository;
    private final ObjectMapper objectMapper;

    public SavedItineraryService(SavedItineraryRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SavedItinerarySummary> list() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(SavedItinerary::getCreatedAt).reversed())
                .map(this::toSummary)
                .toList();
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
        return toSummary(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public SavedItineraryDetail get(Long id) {
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
