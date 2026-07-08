package com.itinerate.controller;

import com.itinerate.model.CreateScrapbookRequest;
import com.itinerate.model.ScrapbookDetail;
import com.itinerate.model.ScrapbookSummary;
import com.itinerate.service.ScrapbookService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/scrapbooks")
public class ScrapbookController {

    private final ScrapbookService scrapbookService;

    public ScrapbookController(ScrapbookService scrapbookService) {
        this.scrapbookService = scrapbookService;
    }

    @GetMapping
    public List<ScrapbookSummary> listScrapbooks() {
        return scrapbookService.listScrapbooks();
    }

    @PostMapping
    public ScrapbookSummary createScrapbook(@Valid @RequestBody CreateScrapbookRequest request) {
        return scrapbookService.createScrapbook(request);
    }

    @GetMapping("/{id}")
    public ScrapbookDetail getScrapbook(@PathVariable Long id) {
        return scrapbookService.getScrapbook(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScrapbook(@PathVariable Long id) {
        scrapbookService.deleteScrapbook(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScrapbookDetail uploadImages(
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files) {
        return scrapbookService.uploadImages(id, files);
    }

    @DeleteMapping("/{id}/images/{imageId}")
    public ScrapbookDetail deleteImage(@PathVariable Long id, @PathVariable Long imageId) {
        return scrapbookService.deleteImage(id, imageId);
    }

    @GetMapping("/{id}/images/{imageId}/content")
    public ResponseEntity<Resource> imageContent(@PathVariable Long id, @PathVariable Long imageId) {
        Resource resource = scrapbookService.loadImageContent(id, imageId);
        String mimeType = scrapbookService.imageMimeType(id, imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(resource);
    }
}
