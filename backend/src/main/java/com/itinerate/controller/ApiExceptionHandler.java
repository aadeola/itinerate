package com.itinerate.controller;

import com.itinerate.service.PlannerException;
import com.itinerate.service.SavedItineraryException;
import com.itinerate.service.ScrapbookException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> messages = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .distinct()
                .collect(Collectors.toList());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Invalid trip request");
        body.put("messages", messages.isEmpty() ? List.of("Invalid request") : messages);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(PlannerException.class)
    public ResponseEntity<Map<String, Object>> handlePlanner(PlannerException ex) {
        if (ex.getStatus() == HttpStatus.SERVICE_UNAVAILABLE) {
            log.warn("Planner not configured: {}", ex.getMessage());
        } else {
            log.warn("Planner failed: {}", ex.getMessage());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("messages", List.of(ex.getMessage()));
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(ScrapbookException.class)
    public ResponseEntity<Map<String, Object>> handleScrapbook(ScrapbookException ex) {
        log.warn("Scrapbook request failed: {}", ex.getMessage());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("messages", List.of(ex.getMessage()));
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(SavedItineraryException.class)
    public ResponseEntity<Map<String, Object>> handleSavedItinerary(SavedItineraryException ex) {
        log.warn("Saved itinerary request failed: {}", ex.getMessage());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("messages", List.of(ex.getMessage()));
        return ResponseEntity.status(ex.getStatus()).body(body);
    }
}
