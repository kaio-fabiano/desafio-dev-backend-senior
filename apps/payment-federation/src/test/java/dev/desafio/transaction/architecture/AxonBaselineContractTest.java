package dev.desafio.transaction.architecture;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AxonBaselineContractTest {
    private static final Path BUILD = Path.of("build.gradle.kts");
    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

    @Test
    @DisplayName("Java sources and SQL use the approved context boundaries @spec:AC-280")
    void javaSourcesAndSqlUseApprovedContextBoundaries() throws Exception {
        var sql = migrationSql();

        assertTrue(sql.contains("create schema if not exists transaction"));
        assertTrue(sql.contains("create schema if not exists inventory"));
        assertTrue(sql.contains("create schema if not exists payment"));
        assertTrue(sql.contains("set local search_path = payment, pg_catalog"));
        assertTrue(sql.contains("set local search_path = inventory, pg_catalog"));
        var statements = Pattern.compile(
            "(?is)(?:create|alter)\\s+table\\s+(transaction|inventory|payment)\\.\\w+.*?;"
        ).matcher(sql);
        while (statements.find()) {
            var owner = statements.group(1);
            var references = Pattern.compile(
                "(?i)references\\s+(transaction|inventory|payment)\\."
            ).matcher(statements.group());
            while (references.find()) {
                assertEquals(owner, references.group(1), statements.group());
            }
        }
    }

    @Test
    @DisplayName("Axon events and processor positions have a durable PostgreSQL baseline @spec:AC-282")
    void axonEventsAndProcessorPositionsHaveDurablePostgresBaseline() throws Exception {
        var build = Files.readString(BUILD);
        var sql = migrationSql();

        assertTrue(build.contains("axon-framework-bom:5.3.1"));
        assertTrue(build.contains("axon-spring-boot-starter"));
        assertTrue(build.contains("org.testcontainers:postgresql"));
        assertTrue(sql.contains("create schema if not exists axon"));
        assertTrue(sql.contains("axon.aggregate_event_entry"));
        assertTrue(sql.contains("axon.token_entry"));
    }

    @Test
    @DisplayName("The Java baseline uses Java 26 and real PostgreSQL quality gates @spec:AC-292")
    void javaBaselineUsesJava26AndRealPostgresQualityGates() throws Exception {
        var build = Files.readString(BUILD);
        var persistenceTest = Files.readString(Path.of(
            "src/test/java/dev/desafio/transaction/infrastructure/axon/AxonPersistenceRestartTest.java"
        ));

        assertTrue(build.contains("JavaLanguageVersion.of(26)"));
        assertTrue(build.contains("com.tngtech.archunit:archunit-junit5"));
        assertTrue(build.contains("testcontainers.version\"] = \"1.21.4"));
        assertTrue(persistenceTest.contains("PostgreSQLContainer"));
        assertFalse(persistenceTest.contains("jdbc:h2"));
    }

    private String migrationSql() throws Exception {
        var sql = new StringBuilder();
        try (var paths = Files.walk(MIGRATIONS)) {
            for (var path : paths.filter(file -> file.toString().endsWith(".sql")).sorted().toList()) {
                sql.append(Files.readString(path).toLowerCase()).append('\n');
            }
        }
        return sql.toString();
    }
}
