package dev.desafio.transaction;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationContext;

import java.time.Clock;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "management.health.rabbit.enabled=false"
    }
)
class PaymentFederationApplicationTest {
    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void healthIsAvailable() {
        assertEquals(HttpStatus.OK, restTemplate.getForEntity("http://localhost:" + port + "/actuator/health", String.class).getStatusCode());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("one UTC application Clock owns time composition @spec:AC-319 @spec:AC-322")
    void applicationClockHasSingleUtcOwner() {
        assertEquals(1, applicationContext.getBeansOfType(Clock.class).size());
        assertEquals(ZoneOffset.UTC, applicationContext.getBean(Clock.class).getZone());
    }
}
