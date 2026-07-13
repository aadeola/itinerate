package com.itinerate.service;

import org.springframework.http.HttpStatus;

public class SavedItineraryException extends RuntimeException {

    private final HttpStatus status;

    public SavedItineraryException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public SavedItineraryException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static SavedItineraryException notFound() {
        return new SavedItineraryException(HttpStatus.NOT_FOUND, "Saved itinerary not found.");
    }

    public static SavedItineraryException serializationFailed(String message, Throwable cause) {
        return new SavedItineraryException(HttpStatus.INTERNAL_SERVER_ERROR, message, cause);
    }
}
