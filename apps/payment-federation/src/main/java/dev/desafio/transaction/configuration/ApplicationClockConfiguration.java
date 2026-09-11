package dev.desafio.transaction.configuration;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ApplicationClockConfiguration {
    @Bean
    Clock applicationClock() {
        return Clock.systemUTC();
    }
}
