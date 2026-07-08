package com.itinerate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinerate.config.ItineraryVisionProperties;
import com.itinerate.model.InferredActivity;
import com.itinerate.model.ResolvedPlace;
import com.itinerate.model.VisionInferRequest;
import com.itinerate.model.VisionInferResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Infers an activity and location from an uploaded screenshot using Google Gemini,
 * then resolves that location to a real place through the llm-proxy's Google Maps
 * MCP endpoint. If Gemini cannot confidently identify a location, a 422 is raised.
 */
@Service
public class VisionActivityService {

    private static final Logger log = LoggerFactory.getLogger(VisionActivityService.class);
    private static final String DEFAULT_MIME_TYPE = "image/png";

    private final ItineraryVisionProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient geminiClient;
    private final RestClient mapsClient;

    public VisionActivityService(ItineraryVisionProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.geminiClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .build();
        this.mapsClient = RestClient.builder().build();
    }

    public VisionInferResponse infer(VisionInferRequest request) {
        // #region agent log
        debugLog("H5", "VisionActivityService.infer", "infer entry", Map.of(
                "enabled", properties.isEnabled(),
                "baseUrl", properties.getBaseUrl(),
                "model", properties.getModel(),
                "keyPrefix", keyPrefix(properties.getApiKey()),
                "imageBase64Len", request.imageBase64() != null ? request.imageBase64().length() : 0,
                "mimeType", request.mimeType() != null ? request.mimeType() : "null"));
        // #endregion
        if (!properties.isEnabled()) {
            throw PlannerException.visionNotConfigured();
        }

        InferredActivity activity = inferActivity(request);
        if (activity.locationQuery() == null || activity.locationQuery().isBlank()) {
            throw PlannerException.couldNotInferLocation();
        }
        if (activity.confidence() != null && activity.confidence() < properties.getMinConfidence()) {
            throw PlannerException.couldNotInferLocation();
        }

        ResolvedPlace place = resolvePlace(activity.locationQuery());
        return new VisionInferResponse(activity, place);
    }

    private InferredActivity inferActivity(VisionInferRequest request) {
        String mimeType = (request.mimeType() == null || request.mimeType().isBlank())
                ? DEFAULT_MIME_TYPE
                : request.mimeType();

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(
                                Map.of("text", visionPrompt()),
                                Map.of("inline_data", Map.of(
                                        "mime_type", mimeType,
                                        "data", request.imageBase64()))))),
                "generationConfig", Map.of("responseMimeType", "application/json"));

        JsonNode response;
        try {
            response = geminiClient.post()
                    .uri("/v1beta/models/{model}:generateContent?key={key}",
                            properties.getModel(), properties.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            // #region agent log
            Map<String, Object> errData = new LinkedHashMap<>();
            errData.put("exception", e.getClass().getSimpleName());
            errData.put("message", e.getMessage() != null ? e.getMessage() : "null");
            if (e instanceof RestClientResponseException rre) {
                errData.put("httpStatus", rre.getStatusCode().value());
                String responseBody = rre.getResponseBodyAsString();
                errData.put("responseBodyPrefix", responseBody != null ? responseBody.substring(0, Math.min(300, responseBody.length())) : "null");
            }
            debugLog("H1", "VisionActivityService.inferActivity", "Gemini request failed", errData);
            // #endregion
            log.error("Gemini vision request failed", e);
            throw mapGeminiError(e);
        }

        if (response == null) {
            throw PlannerException.visionFailed("The vision service returned an empty response.");
        }

        // #region agent log
        debugLog("H3", "VisionActivityService.inferActivity", "Gemini response received", Map.of(
                "hasError", !response.path("error").isMissingNode(),
                "errorMessage", response.path("error").path("message").asText("none"),
                "candidateCount", response.path("candidates").size()));
        // #endregion

        JsonNode textNode = response.path("candidates").path(0)
                .path("content").path("parts").path(0).path("text");
        if (textNode.isMissingNode() || textNode.asText().isBlank()) {
            throw PlannerException.couldNotInferLocation();
        }

        try {
            JsonNode parsed = objectMapper.readTree(extractJson(textNode.asText()));
            return new InferredActivity(
                    text(parsed, "name"),
                    text(parsed, "locationQuery"),
                    text(parsed, "description"),
                    parsed.path("confidence").isNumber() ? parsed.path("confidence").asDouble() : null);
        } catch (Exception e) {
            log.warn("Failed to parse vision JSON response", e);
            throw PlannerException.couldNotInferLocation();
        }
    }

    private ResolvedPlace resolvePlace(String locationQuery) {
        try {
            JsonNode response = mapsClient.post()
                    .uri(properties.getMapsResolveUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("query", locationQuery))
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null || response.path("name").isMissingNode()) {
                return null;
            }
            return new ResolvedPlace(
                    text(response, "name"),
                    text(response, "address"),
                    response.path("latitude").isNumber() ? response.path("latitude").asDouble() : null,
                    response.path("longitude").isNumber() ? response.path("longitude").asDouble() : null,
                    text(response, "placeId"),
                    text(response, "mapsUrl"));
        } catch (Exception e) {
            // Maps resolution is best-effort; the inferred activity is still useful.
            log.warn("Maps resolution failed for query '{}': {}", locationQuery, e.getMessage());
            return null;
        }
    }

    private String visionPrompt() {
        return """
                You are analyzing a screenshot or photo a traveler wants to add to their
                trip. Identify the single most likely real-world place, activity, or point
                of interest shown. Use any visible text (business names, signs, captions),
                landmarks, and scenery.

                Return ONLY a JSON object of this exact shape:
                {
                  "name": "short activity or place name (e.g. \\"Visit the Eiffel Tower\\", \\"CorePower Pilates\\")",
                  "locationQuery": "the most specific searchable location string, including city/area if known (e.g. \\"Eiffel Tower, Paris\\", \\"CorePower Yoga, Atlanta\\")",
                  "description": "one short sentence describing what is shown",
                  "confidence": 0.0
                }

                Rules:
                - "confidence" is your 0..1 certainty that "locationQuery" identifies a real place.
                - If you cannot identify any real place or location, set "locationQuery" to ""
                  and "confidence" to 0.
                - Do not invent a location that is not supported by the image.
                """;
    }

    private String extractJson(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```(?:json)?\\s*", "");
            trimmed = trimmed.replaceFirst("\\s*```\\s*$", "");
        }
        return trimmed.trim();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text.isBlank() ? null : text;
    }

    private String keyPrefix(String key) {
        if (key == null || key.isBlank()) {
            return "empty";
        }
        return key.substring(0, Math.min(6, key.length())) + "...";
    }

    private PlannerException mapGeminiError(RestClientException e) {
        if (e instanceof RestClientResponseException rre) {
            int status = rre.getStatusCode().value();
            if (status == 429) {
                return PlannerException.visionQuotaExceeded();
            }
            if (status == 401 || status == 403) {
                return PlannerException.visionUnauthorized();
            }
            String geminiMessage = parseGeminiErrorMessage(rre.getResponseBodyAsString());
            if (geminiMessage != null) {
                return PlannerException.visionFailed("Vision service error: " + geminiMessage);
            }
            return PlannerException.visionFailed("Vision service returned HTTP " + status);
        }
        return PlannerException.visionFailed(
                "Could not reach the vision service. Check your network connection.", e);
    }

    private String parseGeminiErrorMessage(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode error = objectMapper.readTree(body).path("error").path("message");
            if (!error.isMissingNode() && !error.asText().isBlank()) {
                String message = error.asText();
                int newline = message.indexOf('\n');
                return newline > 0 ? message.substring(0, newline) : message;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    // #region agent log
    private void debugLog(String hypothesisId, String location, String message, Map<String, Object> data) {
        try {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("sessionId", "9aa49d");
            entry.put("hypothesisId", hypothesisId);
            entry.put("location", location);
            entry.put("message", message);
            entry.put("data", data);
            entry.put("timestamp", System.currentTimeMillis());
            String line = objectMapper.writeValueAsString(entry) + "\n";
            Files.writeString(
                    Path.of("/Users/ade/Workspaces/cursor/itinerate/.cursor/debug-9aa49d.log"),
                    line,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
        } catch (Exception ignored) {
            // debug logging must not affect inference
        }
    }
    // #endregion
}
