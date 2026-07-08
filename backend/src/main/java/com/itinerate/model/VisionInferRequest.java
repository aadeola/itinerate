package com.itinerate.model;

import jakarta.validation.constraints.NotBlank;

/**
 * Request to infer an activity from a screenshot. The image is sent as a base64
 * string alongside its MIME type (e.g. {@code image/png}).
 */
public record VisionInferRequest(
        @NotBlank(message = "An image is required")
        String imageBase64,

        String mimeType
) {
}
