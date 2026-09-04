package dev.desafio.payment;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SonarConfigurationTest {
    @Test
    @DisplayName("@spec:AC-194 configures the Gradle Sonar scanner")
    void specAc194ConfiguresTheGradleSonarScanner() throws Exception {
        var buildFile = Files.readString(Path.of("build.gradle.kts"));

        assertTrue(buildFile.contains("id(\"org.sonarqube\")"));
        assertTrue(buildFile.contains("jacoco"));
        assertTrue(buildFile.contains("xml.required = true"));
        assertTrue(buildFile.contains("tasks.named(\"sonar\")"));
        assertTrue(buildFile.contains("dependsOn(tasks.named(\"check\"), tasks.jacocoTestReport)"));
    }
}
