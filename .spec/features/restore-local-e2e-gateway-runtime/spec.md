# Spec: Restore local e2e gateway runtime

> feature: restore-local-e2e-gateway-runtime
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

The Gateway image defaults to `NODE_ENV=production`, while the isolated Compose
acceptance environment has no AWS DynamoDB replay table. After the DPoP
fail-closed hardening, the canonical E2E topology exits before the buyer journey
starts even though the deployed SST service correctly binds shared replay
storage.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-157 — Run the isolated acceptance topology without weakening production DPoP

As a release operator, I want the local Compose Gateway to use an explicit
non-production runtime so that the canonical E2E journey can run while AWS
deployments still require shared DPoP replay storage.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-351 — Compose and AWS preserve their distinct replay-storage boundaries

- **Dado** the Gateway image defaults to production and production startup fails
  closed without `DPOP_REPLAY_TABLE`
- **Quando** the isolated Compose topology and SST deployment configuration are
  inspected
- **Então** Compose explicitly runs Gateway outside production while SST keeps
  `NODE_ENV=production` and binds `DPOP_REPLAY_TABLE`

## Fora de escopo

- Adding DynamoDB Local or another replay-store service to Compose.
- Weakening the production startup guard.
- Changing the AWS deployment topology.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-128 | Compose is an isolated acceptance environment rather than a production runtime. | confirmada | The E2E runbook and Testcontainers lifecycle create and destroy the topology per acceptance run. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

Nenhuma.
