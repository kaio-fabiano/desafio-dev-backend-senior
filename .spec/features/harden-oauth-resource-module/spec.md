# Spec: Harden oauth resource module

> feature: harden-oauth-resource-module
> status: implementada

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

The reusable OAuth resource module needs idiomatic NestJS metadata and
integration tests proving its dynamic-provider contract.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-109 — Make OAuth module composition explicit

As a platform maintainer, I want the OAuth resource module composed and tested
through NestJS so invalid or shared configuration cannot fail silently.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-223 — Dynamic OAuth module is isolated and fail-fast

- **Dado** applications register the OAuth resource module with independent options
- **Quando** NestJS compiles each application container
- **Então** the service and guard resolve through exported providers, invalid options fail during compilation, and caller mutations cannot alter registered configuration

## Fora de escopo

- Enforcing HTTPS for private container-network endpoints.
- Replacing the small dynamic module with `ConfigurableModuleBuilder`.
- Registering multiple OAuth audiences inside one NestJS container.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
Nenhuma.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
