plugins {
    java
    jacoco
    id("org.sonarqube") version "7.0.1.6134"
    id("org.springframework.boot") version "3.5.6"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "dev.desafio"
version = "0.0.1-SNAPSHOT"
extra["jackson-bom.version"] = "2.22.1"
extra["testcontainers.version"] = "1.21.4"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(platform("org.axonframework:axon-framework-bom:5.3.1"))
    implementation("org.axonframework.extensions.spring:axon-spring-boot-starter")
    implementation("org.axonframework.extensions.reactor:axon-reactor:5.3.1")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-graphql")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-amqp")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("io.micrometer:micrometer-tracing-bridge-otel")
    implementation("com.mercadopago:sdk-java:3.3.1")
    runtimeOnly("io.micrometer:micrometer-registry-prometheus")
    runtimeOnly("io.opentelemetry:opentelemetry-exporter-otlp")
    implementation("com.apollographql.federation:federation-graphql-java-support:5.5.0")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.axonframework:axon-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
    testRuntimeOnly("com.h2database:h2")
}

tasks.withType<Test> {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required = true
    }
}

tasks.named("sonar") {
    dependsOn(tasks.named("check"), tasks.jacocoTestReport)
}
