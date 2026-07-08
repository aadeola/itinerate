package com.itinerate.controller;

import com.itinerate.model.VisionInferRequest;
import com.itinerate.model.VisionInferResponse;
import com.itinerate.service.VisionActivityService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vision")
public class VisionController {

    private final VisionActivityService visionService;

    public VisionController(VisionActivityService visionService) {
        this.visionService = visionService;
    }

    @PostMapping("/infer")
    public VisionInferResponse infer(@Valid @RequestBody VisionInferRequest request) {
        return visionService.infer(request);
    }
}
