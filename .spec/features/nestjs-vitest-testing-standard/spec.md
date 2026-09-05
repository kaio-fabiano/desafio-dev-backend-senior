# Spec: Nestjs vitest testing standard

> feature: nestjs-vitest-testing-standard
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

## Contexto

The repository has Vitest end-to-end tests and structural Node tests, but no
shared NestJS unit-testing standard, no Nest testing utilities, and no per-file
Vitest coverage gate for the shared libraries. Before TODO remediation starts,
the project needs one enforceable testing contract that distinguishes unit,
integration, contract, and end-to-end tests and requires TDD for every task.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-104 — Establish a strong NestJS testing standard

As a maintainer, I want shared NestJS libraries developed through fast,
strongly typed Vitest tests, so that every reviewed TODO gains behavioral proof
before its production implementation changes.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-208 — The repository defines one official testing contract

- **Dado** contributors changing a NestJS library
- **Quando** they consult the repository testing standard
- **Então** it defines test taxonomy, typed mocking, Nest TestingModule boundaries, file naming, isolation, prohibited shortcuts, and the required delivery report

#### AC-209 — Every implementation task follows TDD

- **Dado** an approved task that changes production behavior
- **Quando** execution begins and later reaches its completion gate
- **Então** the task records an expected Red failure, a minimal Green implementation, a Refactor pass, and green unit, integration, typecheck, lint, verification, and audit results

#### AC-210 — Vitest coverage fails below the agreed floor

- **Dado** a reviewed NestJS library enabled in the shared Vitest configuration
- **Quando** CI collects coverage per production file
- **Então** the command fails below 90 percent lines, statements, or functions and 85 percent branches, while critical authentication, authorization, ownership, and idempotency code requires 100 percent lines, statements, and functions and 95 percent branches

#### AC-211 — Every NestJS library owns fast unit-test targets

- **Dado** a shared NestJS library being reviewed folder by folder
- **Quando** its Nx test and coverage targets run
- **Então** colocated Vitest unit tests execute without containers or external networks, while integration and end-to-end suites remain separate

## Fora de escopo

- Adding tests for every shared library before its folder is reviewed.
- Replacing existing integration, contract, or end-to-end evidence.
- Introducing automatic-mocking libraries or testing implementation details.
- Changing production behavior merely to make tests easier to write.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-073 | Per-file thresholds can be enabled incrementally as each library folder completes review without lowering the approved floors. | confirmada | Each reviewed project explicitly opts its production files into the shared coverage configuration before its TODOs are considered complete. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
