FROM gradle:8.14.3-jdk21 AS build
WORKDIR /workspace
COPY apps/payment-federation/ .
RUN gradle clean --no-daemon bootJar

FROM eclipse-temurin:21.0.8_9-jre AS runtime
RUN apt-get update && apt-get install --yes --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app
COPY --from=build --chown=app:app /workspace/build/libs/*.jar app.jar
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl --fail --silent http://127.0.0.1:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
