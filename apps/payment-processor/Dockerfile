FROM gradle:8.14.3-jdk21 AS build
WORKDIR /workspace
COPY apps/payment-processor/ .
RUN gradle --no-daemon bootJar

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install --yes --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
