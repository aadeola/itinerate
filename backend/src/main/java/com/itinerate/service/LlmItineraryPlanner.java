package com.itinerate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinerate.config.ItineraryLlmProperties;
import com.itinerate.model.ActivityInput;
import com.itinerate.model.DayPlan;
import com.itinerate.model.Itinerary;
import com.itinerate.model.ScheduledActivity;
import com.itinerate.model.TripRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Planner that asks an OpenAI-compatible chat model to resolve each activity's
 * location within the trip city and produce a geographically sensible day-by-day
 * schedule.
 */
public class LlmItineraryPlanner implements ItineraryPlanner {

    private static final Logger log = LoggerFactory.getLogger(LlmItineraryPlanner.class);

    private final ItineraryLlmProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public LlmItineraryPlanner(ItineraryLlmProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .build();
    }

    @Override
    public Itinerary plan(TripRequest request) {
        if (!properties.isEnabled()) {
            throw PlannerException.notConfigured();
        }

        long planStart = System.currentTimeMillis();
        try {
            String content = callModel(request);
            // #region agent log
            debugLog("A", "LlmItineraryPlanner.plan", "Plan complete", Map.of(
                    "totalElapsedMs", System.currentTimeMillis() - planStart,
                    "contentLength", content.length(),
                    "activityCount", request.activities().size()));
            // #endregion
            return parseItinerary(content, request);
        } catch (PlannerException e) {
            // #region agent log
            debugLog("C", "LlmItineraryPlanner.plan", "PlannerException", Map.of(
                    "totalElapsedMs", System.currentTimeMillis() - planStart,
                    "message", e.getMessage(),
                    "status", e.getStatus().value()));
            // #endregion
            throw e;
        } catch (RestClientException e) {
            String exceptionMessage = e.getMessage() != null ? e.getMessage() : "null";
            // #region agent log
            debugLog("A", "LlmItineraryPlanner.plan", "RestClientException", Map.of(
                    "totalElapsedMs", System.currentTimeMillis() - planStart,
                    "message", exceptionMessage,
                    "baseUrl", properties.getBaseUrl()));
            // #endregion
            log.error("LLM HTTP request failed", e);
            String detail = "could not reach the AI service";
            if (exceptionMessage.contains("Connection refused")) {
                detail = "could not reach the AI service — llm-proxy is not running on "
                        + properties.getBaseUrl()
                        + ". Start it with: cd llm-proxy && npm run start";
            }
            throw PlannerException.plannerFailed(detail, e);
        } catch (Exception e) {
            // #region agent log
            debugLog("B", "LlmItineraryPlanner.plan", "Unexpected parse/plan failure", Map.of(
                    "totalElapsedMs", System.currentTimeMillis() - planStart,
                    "exception", e.getClass().getSimpleName(),
                    "message", e.getMessage() != null ? e.getMessage() : "null"));
            // #endregion
            log.error("LLM planner failed", e);
            throw PlannerException.plannerFailed(e.getMessage(), e);
        }
    }

    private String callModel(TripRequest request) {
        long callStart = System.currentTimeMillis();
        // #region agent log
        debugLog("A", "LlmItineraryPlanner.callModel", "Calling LLM", Map.of(
                "baseUrl", properties.getBaseUrl(),
                "model", properties.getModel(),
                "activityCount", request.activities().size(),
                "systemPromptLength", systemPrompt().length()));
        // #endregion
        Map<String, Object> body = Map.of(
                "model", properties.getModel(),
                "temperature", 0.3,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt()),
                        Map.of("role", "user", "content", userPrompt(request))));

        JsonNode response = restClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + properties.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw PlannerException.plannerFailed("empty response from AI service", null);
        }
        JsonNode message = response.path("choices").path(0).path("message").path("content");
        if (message.isMissingNode() || message.asText().isBlank()) {
            throw PlannerException.plannerFailed("AI response missing message content", null);
        }
        // #region agent log
        debugLog("A", "LlmItineraryPlanner.callModel", "LLM call complete", Map.of(
                "elapsedMs", System.currentTimeMillis() - callStart,
                "contentLength", message.asText().length()));
        // #endregion
        return message.asText();
    }

    private String systemPrompt() {
        return """
                You are a travel itinerary planner. For each activity, resolve a specific
                neighborhood, district, or landmark within the trip city; schedule concrete
                start/end times (HH:mm) inside the daily window; and give a brief reason.
                Group nearby activities on the same day and minimize back-and-forth travel.
                Schedule exactly one item per listed activity (no extras). Keep the summary
                to one short sentence and each reason under 8 words.
                Every item needs a non-empty "location". Respond ONLY with JSON:
                {"summary":"one sentence","days":[{"dayNumber":1,"items":[{"name":"","location":"","startTime":"09:00","endTime":"10:30","reason":""}]}]}
                """;
    }

    private String userPrompt(TripRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("City: ").append(request.city()).append('\n');
        sb.append("Days: ").append(request.days()).append('\n');
        sb.append("Daily window: ").append(request.startTime())
                .append(" to ").append(request.endTime()).append('\n');
        sb.append("Activities (resolve each one's location in ").append(request.city()).append("):\n");
        for (ActivityInput a : request.activities()) {
            sb.append("- ").append(a.name());
            if (a.location() != null && !a.location().isBlank()) {
                sb.append(" [traveler hint: ").append(a.location().trim()).append(']');
            }
            if (a.durationMinutes() != null) {
                sb.append(" [~").append(a.durationMinutes()).append(" min]");
            }
            if (a.notes() != null && !a.notes().isBlank()) {
                sb.append(" note: ").append(a.notes().trim());
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private Itinerary parseItinerary(String content, TripRequest request) throws Exception {
        String json = extractJsonContent(content);
        // #region agent log
        debugLog("B", "LlmItineraryPlanner.parseItinerary", "JSON extracted for parsing", Map.of(
                "hadMarkdownFence", content.trim().startsWith("```"),
                "jsonPrefix", json.substring(0, Math.min(120, json.length()))));
        // #endregion
        JsonNode root = objectMapper.readTree(json);
        List<DayPlan> days = new ArrayList<>();

        for (JsonNode dayNode : root.path("days")) {
            int dayNumber = dayNode.path("dayNumber").asInt(days.size() + 1);
            List<ScheduledActivity> items = new ArrayList<>();
            for (JsonNode itemNode : dayNode.path("items")) {
                ScheduledActivity item = new ScheduledActivity(
                        text(itemNode, "name"),
                        text(itemNode, "location"),
                        text(itemNode, "startTime"),
                        text(itemNode, "endTime"),
                        text(itemNode, "reason"));
                validateItem(item, dayNumber);
                items.add(item);
            }
            days.add(new DayPlan(dayNumber, items));
        }

        if (days.isEmpty()) {
            throw PlannerException.invalidResponse("no days returned");
        }

        boolean hasActivities = days.stream().anyMatch(d -> !d.items().isEmpty());
        if (!hasActivities) {
            throw PlannerException.invalidResponse("no activities scheduled");
        }

        String summary = root.path("summary").asText(null);
        return new Itinerary(request.city(), days, summary);
    }

    private void validateItem(ScheduledActivity item, int dayNumber) {
        if (item.name() == null || item.name().isBlank()) {
            throw PlannerException.invalidResponse("activity on day " + dayNumber + " missing name");
        }
        if (item.location() == null || item.location().isBlank()) {
            throw PlannerException.invalidResponse(
                    "activity \"" + item.name() + "\" on day " + dayNumber + " missing resolved location");
        }
        if (item.startTime() == null || item.startTime().isBlank()) {
            throw PlannerException.invalidResponse(
                    "activity \"" + item.name() + "\" on day " + dayNumber + " missing startTime");
        }
        if (item.endTime() == null || item.endTime().isBlank()) {
            throw PlannerException.invalidResponse(
                    "activity \"" + item.name() + "\" on day " + dayNumber + " missing endTime");
        }
    }

    private String extractJsonContent(String content) {
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

    // #region agent log
    private void debugLog(String hypothesisId, String location, String message, Map<String, Object> data) {
        try {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("sessionId", "4fb88c");
            entry.put("hypothesisId", hypothesisId);
            entry.put("location", location);
            entry.put("message", message);
            entry.put("data", data);
            entry.put("timestamp", System.currentTimeMillis());
            String line = objectMapper.writeValueAsString(entry) + "\n";
            java.nio.file.Files.writeString(
                    java.nio.file.Path.of("/Users/ade/Workspaces/cursor/itinerate/.cursor/debug-4fb88c.log"),
                    line,
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        } catch (Exception ignored) {
            // debug logging must not affect planning
        }
    }
    // #endregion
}
