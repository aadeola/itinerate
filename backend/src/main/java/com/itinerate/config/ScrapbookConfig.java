package com.itinerate.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ScrapbookProperties.class)
public class ScrapbookConfig {}
