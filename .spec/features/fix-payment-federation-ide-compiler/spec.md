# Spec: Fix Payment Federation IDE compiler diagnostics

> feature: fix-payment-federation-ide-compiler
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Context

The Payment Federation module was configured for Gradle 8.14.3 and Java 21 while the development environment uses Java 26. Gradle 8.14.3 cannot evaluate the Kotlin build scripts on Java 26, so the IDE cannot import the Gradle model and consequently reports missing Spring classes as compiler errors.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-137 — Import the Payment Federation Gradle model reliably

As a maintainer, I want the Payment Federation module to use Java 26 with a compatible declared Gradle distribution, so that IDEs, local tooling, and container builds resolve the same Java classpath.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-294 — The module provides a pinned Gradle Wrapper

- **Dado** the Payment Federation Gradle project
- **Quando** an IDE or developer imports the module without a system Gradle installation
- **Então** the checked-in wrapper selects Gradle 9.7.1 and can compile production and test sources on Java 26

#### AC-295 — Every Payment Federation build surface uses Java 26

- **Dado** the Payment Federation Gradle, Docker, Nx, and repository quality configurations
- **Quando** the module is compiled or tested through any supported project command
- **Então** every build surface uses the Java 26 toolchain and the compatible Gradle 9.7.1 image

## Fora de escopo

- Changing application behavior, dependencies, or package names.
- Changing the user's existing VS Code settings.
- Installing another JDK.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-106 | The reported Java diagnostics are IDE classpath errors rather than source compilation errors. | confirmada | A forced Gradle 8.14.3/JDK 21 compilation of main and test sources completed successfully; the IDE log records a missing wrapper and a failed fallback Gradle initialization. |
| ASM-107 | Gradle 9.7.1 is compatible with the current Spring Boot and Axon build. | confirmada | A clean temporary copy compiled production and test sources successfully with the official Gradle 9.7.1 Java 26 image. |

## Perguntas em aberto

None.
