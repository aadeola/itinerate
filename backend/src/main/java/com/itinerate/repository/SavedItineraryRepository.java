package com.itinerate.repository;

import com.itinerate.entity.SavedItinerary;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedItineraryRepository extends JpaRepository<SavedItinerary, Long> {}
