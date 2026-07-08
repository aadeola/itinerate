package com.itinerate.service;

import com.itinerate.model.Itinerary;
import com.itinerate.model.TripRequest;

/** Turns a trip request into an ordered, time-slotted itinerary. */
public interface ItineraryPlanner {

    Itinerary plan(TripRequest request);
}
