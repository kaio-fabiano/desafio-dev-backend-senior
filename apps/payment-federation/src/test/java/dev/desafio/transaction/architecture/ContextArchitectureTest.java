package dev.desafio.transaction.architecture;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ContextArchitectureTest {
    @Test
    @DisplayName("Context and layer imports point inward without a hidden orchestrator @spec:AC-280")
    void contextAndLayerImportsPointInwardWithoutHiddenOrchestrator() {
        var classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("dev.desafio.transaction");

        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideOutsideOfPackages(
                "java..",
                "dev.desafio.transaction.payment.domain..",
                "dev.desafio.transaction.inventory.domain..",
                "dev.desafio.transaction.transaction.domain..",
                "org.axonframework.eventsourcing.annotations.."
            ).check(classes);

        noClasses().that().resideInAPackage("..application..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "..adapter..", "..infrastructure..", "..interfaces..", "..configuration.."
            ).check(classes);

        assertNoContextDependency(classes, "payment", "inventory", "transaction");
        assertNoContextDependency(classes, "inventory", "payment", "transaction");
        if (classes.stream().anyMatch(type -> type.getPackageName().startsWith(
            "dev.desafio.transaction.transaction"
        ))) {
            assertNoContextDependency(classes, "transaction", "payment", "inventory");
        }

        assertFalse(classes.stream().anyMatch(type -> type.getSimpleName().matches(
            ".*(Saga|Workflow|Orchestrator|Coordinator|ProcessManager).*"
        )));
    }

    private void assertNoContextDependency(
        com.tngtech.archunit.core.domain.JavaClasses classes,
        String owner,
        String... foreignContexts
    ) {
        var foreignPackages = java.util.Arrays.stream(foreignContexts)
            .map(context -> "dev.desafio.transaction." + context + "..")
            .toArray(String[]::new);
        noClasses().that().resideInAPackage("dev.desafio.transaction." + owner + "..")
            .should().dependOnClassesThat().resideInAnyPackage(foreignPackages)
            .check(classes);
    }
}
