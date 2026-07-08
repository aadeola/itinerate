package com.itinerate.service;

import com.itinerate.config.ScrapbookProperties;
import com.itinerate.entity.Scrapbook;
import com.itinerate.entity.ScrapbookImage;
import com.itinerate.model.CreateScrapbookRequest;
import com.itinerate.model.ScrapbookDetail;
import com.itinerate.model.ScrapbookImageResponse;
import com.itinerate.model.ScrapbookSummary;
import com.itinerate.repository.ScrapbookImageRepository;
import com.itinerate.repository.ScrapbookRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;

@Service
public class ScrapbookService {

    private final ScrapbookRepository scrapbookRepository;
    private final ScrapbookImageRepository imageRepository;
    private final ScrapbookProperties properties;
    private Path uploadRoot;

    public ScrapbookService(
            ScrapbookRepository scrapbookRepository,
            ScrapbookImageRepository imageRepository,
            ScrapbookProperties properties) {
        this.scrapbookRepository = scrapbookRepository;
        this.imageRepository = imageRepository;
        this.properties = properties;
    }

    @PostConstruct
    void init() throws IOException {
        uploadRoot = Path.of(properties.uploadDir()).toAbsolutePath().normalize();
        Files.createDirectories(uploadRoot);
    }

    @Transactional(readOnly = true)
    public List<ScrapbookSummary> listScrapbooks() {
        return scrapbookRepository.findAll().stream()
                .sorted(Comparator.comparing(Scrapbook::getUpdatedAt).reversed())
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public ScrapbookSummary createScrapbook(CreateScrapbookRequest request) {
        Scrapbook scrapbook = new Scrapbook();
        scrapbook.setName(request.name().trim());
        Scrapbook saved = scrapbookRepository.save(scrapbook);
        return toSummary(saved);
    }

    @Transactional(readOnly = true)
    public ScrapbookDetail getScrapbook(Long id) {
        Scrapbook scrapbook = findScrapbook(id);
        return toDetail(scrapbook);
    }

    @Transactional
    public void deleteScrapbook(Long id) {
        Scrapbook scrapbook = findScrapbook(id);
        deleteStoredFiles(scrapbookDir(id));
        scrapbookRepository.delete(scrapbook);
    }

    @Transactional
    public ScrapbookDetail uploadImages(Long scrapbookId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw ScrapbookException.badRequest("Choose at least one image to upload.");
        }
        if (files.size() > properties.maxFilesPerUpload()) {
            throw ScrapbookException.badRequest(
                    "You can upload up to " + properties.maxFilesPerUpload() + " images at a time.");
        }

        Scrapbook scrapbook = findScrapbook(scrapbookId);
        Path scrapbookDir = scrapbookDir(scrapbookId);
        try {
            Files.createDirectories(scrapbookDir);
        } catch (IOException e) {
            throw ScrapbookException.storageFailed("Could not prepare scrapbook storage.", e);
        }

        int nextSortOrder = scrapbook.getImages().size();
        for (MultipartFile file : files) {
            validateImage(file);
            String extension = extensionFor(file);
            String storageFilename = UUID.randomUUID() + extension;
            Path destination = scrapbookDir.resolve(storageFilename).normalize();
            if (!destination.startsWith(scrapbookDir)) {
                throw ScrapbookException.badRequest("Invalid file name.");
            }

            try {
                Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                throw ScrapbookException.storageFailed("Could not save one of the images.", e);
            }

            ScrapbookImage image = new ScrapbookImage();
            image.setStorageFilename(storageFilename);
            image.setOriginalFilename(safeOriginalName(file.getOriginalFilename()));
            image.setMimeType(file.getContentType());
            image.setSizeBytes(file.getSize());
            image.setSortOrder(nextSortOrder++);
            scrapbook.addImage(image);
        }

        scrapbookRepository.save(scrapbook);
        return toDetail(scrapbook);
    }

    @Transactional
    public ScrapbookDetail deleteImage(Long scrapbookId, Long imageId) {
        Scrapbook scrapbook = findScrapbook(scrapbookId);
        ScrapbookImage image = imageRepository.findById(imageId)
                .filter(existing -> existing.getScrapbook().getId().equals(scrapbookId))
                .orElseThrow(() -> ScrapbookException.notFound("Image"));

        Path imagePath = scrapbookDir(scrapbookId).resolve(image.getStorageFilename());
        try {
            Files.deleteIfExists(imagePath);
        } catch (IOException e) {
            throw ScrapbookException.storageFailed("Could not delete the image file.", e);
        }

        scrapbook.getImages().remove(image);
        scrapbookRepository.save(scrapbook);
        return toDetail(scrapbook);
    }

    @Transactional(readOnly = true)
    public Resource loadImageContent(Long scrapbookId, Long imageId) {
        ScrapbookImage image = imageRepository.findById(imageId)
                .filter(existing -> existing.getScrapbook().getId().equals(scrapbookId))
                .orElseThrow(() -> ScrapbookException.notFound("Image"));

        Path imagePath = scrapbookDir(scrapbookId).resolve(image.getStorageFilename()).normalize();
        Path scrapbookDir = scrapbookDir(scrapbookId);
        if (!imagePath.startsWith(scrapbookDir)) {
            throw ScrapbookException.notFound("Image");
        }

        if (!Files.exists(imagePath)) {
            throw ScrapbookException.notFound("Image");
        }

        try {
            Resource resource = new UrlResource(imagePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw ScrapbookException.notFound("Image");
            }
            return resource;
        } catch (IOException e) {
            throw ScrapbookException.storageFailed("Could not read the image file.", e);
        }
    }

    @Transactional(readOnly = true)
    public String imageMimeType(Long scrapbookId, Long imageId) {
        return imageRepository.findById(imageId)
                .filter(existing -> existing.getScrapbook().getId().equals(scrapbookId))
                .map(ScrapbookImage::getMimeType)
                .orElse("application/octet-stream");
    }

    private Scrapbook findScrapbook(Long id) {
        return scrapbookRepository.findById(id)
                .orElseThrow(() -> ScrapbookException.notFound("Scrapbook"));
    }

    private void validateImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw ScrapbookException.badRequest("One of the selected files is empty.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw ScrapbookException.badRequest("Only image files are allowed.");
        }
        if (file.getSize() > properties.maxFileSizeBytes()) {
            throw ScrapbookException.badRequest("Each image must be 8 MB or smaller.");
        }
    }

    private String safeOriginalName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "image";
        }
        String name = Path.of(originalFilename).getFileName().toString();
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    private String extensionFor(MultipartFile file) {
        String original = file.getOriginalFilename();
        if (original != null) {
            int dot = original.lastIndexOf('.');
            if (dot >= 0 && dot < original.length() - 1) {
                String ext = original.substring(dot).toLowerCase(Locale.ROOT);
                if (ext.matches("\\.[a-z0-9]{1,8}")) {
                    return ext;
                }
            }
        }

        return switch (file.getContentType()) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/heic", "image/heif" -> ".heic";
            default -> ".bin";
        };
    }

    private Path scrapbookDir(Long scrapbookId) {
        return uploadRoot.resolve(String.valueOf(scrapbookId)).normalize();
    }

    private void deleteStoredFiles(Path scrapbookDir) {
        if (!Files.exists(scrapbookDir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(scrapbookDir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    throw ScrapbookException.storageFailed("Could not delete scrapbook files.", e);
                }
            });
        } catch (IOException e) {
            throw ScrapbookException.storageFailed("Could not delete scrapbook files.", e);
        }
    }

    private ScrapbookSummary toSummary(Scrapbook scrapbook) {
        return new ScrapbookSummary(
                scrapbook.getId(),
                scrapbook.getName(),
                scrapbook.getImages().size(),
                scrapbook.getCreatedAt(),
                scrapbook.getUpdatedAt());
    }

    private ScrapbookDetail toDetail(Scrapbook scrapbook) {
        List<ScrapbookImageResponse> images = scrapbook.getImages().stream()
                .map(image -> toImageResponse(scrapbook.getId(), image))
                .toList();
        return new ScrapbookDetail(
                scrapbook.getId(),
                scrapbook.getName(),
                scrapbook.getCreatedAt(),
                scrapbook.getUpdatedAt(),
                images);
    }

    private ScrapbookImageResponse toImageResponse(Long scrapbookId, ScrapbookImage image) {
        return new ScrapbookImageResponse(
                image.getId(),
                image.getOriginalFilename(),
                image.getMimeType(),
                image.getSizeBytes(),
                image.getSortOrder(),
                image.getCreatedAt(),
                "/api/scrapbooks/" + scrapbookId + "/images/" + image.getId() + "/content");
    }
}
