package com.itinerate.service;

import org.springframework.http.HttpStatus;

/**
 * Raised when itinerary planning cannot complete. Carries the HTTP status the API
 * should return to the client.
 */
public class PlannerException extends RuntimeException {

    private final HttpStatus status;

    public PlannerException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public PlannerException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static PlannerException notConfigured() {
        return new PlannerException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "LLM planner is not configured. Set ITINERARY_LLM_API_KEY before starting the backend.");
    }

    public static PlannerException plannerFailed(String detail, Throwable cause) {
        return new PlannerException(
                HttpStatus.BAD_GATEWAY,
                "Could not build your itinerary. The AI planner failed: " + detail,
                cause);
    }

    public static PlannerException invalidResponse(String detail) {
        return new PlannerException(
                HttpStatus.BAD_GATEWAY,
                "Could not build your itinerary. The AI planner returned an invalid response: " + detail);
    }

    public static PlannerException visionNotConfigured() {
        return new PlannerException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Screenshot inference is not configured. Set ITINERARY_VISION_API_KEY before starting the backend.");
    }

    public static PlannerException couldNotInferLocation() {
        return new PlannerException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "We couldn't identify a location from that image. Please submit a clearer image.");
    }

    public static PlannerException visionFailed(String message) {
        return new PlannerException(HttpStatus.BAD_GATEWAY, message);
    }

    public static PlannerException visionFailed(String message, Throwable cause) {
        return new PlannerException(HttpStatus.BAD_GATEWAY, message, cause);
    }

    public static PlannerException visionQuotaExceeded() {
        return new PlannerException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Gemini vision quota exceeded for this model. Wait about a minute and try again, "
                        + "or set ITINERARY_VISION_MODEL to another model (e.g. gemini-2.5-flash) in backend/.env.");
    }

    public static PlannerException visionUnauthorized() {
        return new PlannerException(
                HttpStatus.BAD_GATEWAY,
                "Invalid Google AI Studio API key. Check ITINERARY_VISION_API_KEY in backend/.env.");
    }

    public static PlannerException geocodingNotConfigured() {
        return new PlannerException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Itinerary map geocoding is not configured. Set ITINERARY_GEOCODING_API_KEY in backend/.env "
                        + "(Google Maps Platform key with Geocoding API enabled).");
    }
}
