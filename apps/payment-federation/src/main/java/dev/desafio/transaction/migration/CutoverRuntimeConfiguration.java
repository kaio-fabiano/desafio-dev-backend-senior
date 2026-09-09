package dev.desafio.transaction.migration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.Clock;

@Configuration(proxyBeanMethods = false)
public class CutoverRuntimeConfiguration {
    @Bean
    @Primary
    Clock cutoverClock() {
        return Clock.systemUTC();
    }
}
