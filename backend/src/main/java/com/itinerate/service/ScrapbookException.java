package com.itinerate.service;

import org.springframework.http.HttpStatus;

public class ScrapbookException extends RuntimeException {

    private final HttpStatus status;

    public ScrapbookException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public ScrapbookException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ScrapbookException notFound(String resource) {
        return new ScrapbookException(HttpStatus.NOT_FOUND, resource + " not found.");
    }

    public static ScrapbookException badRequest(String message) {
        return new ScrapbookException(HttpStatus.BAD_REQUEST, message);
    }

    public static ScrapbookException storageFailed(String message, Throwable cause) {
        return new ScrapbookException(HttpStatus.INTERNAL_SERVER_ERROR, message, cause);
    }
}
