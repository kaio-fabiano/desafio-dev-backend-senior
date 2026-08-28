# Plano de execução — federated-platform-architecture-refactor

> gerado por `onp-spec plano` em 2026-08-28 22:43 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano federated-platform-architecture-refactor`

## Resumo — o que vai acontecer

- **9 tarefa(s) pendente(s)**: 9 em 8 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano federated-platform-architecture-refactor --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/federated-platform-architecture-refactor`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/federated-platform-architecture-refactor-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-065 | Lock the target architecture and executable boundaries | `gpt-5.6-sol` | high | `docs/adrs/007-federated-platform-boundaries.md`, `docs/prds/01-arquitetura-e-dominio.md`, `docs/prds/02-graphql-federation.md`, `docs/prds/04-commerce-saga-e-realtime.md`, `test/architecture-boundaries.test.mjs`, `test/federated-platform-refactor.test.mjs` |

#### faixa-2 — branch `spec/federated-platform-architecture-refactor-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-066 | Extract NestJS composition libraries and provider contracts | `gpt-5.6-terra` | medium | `libs/platform/nest/src/config/config.module.ts`, `libs/platform/nest/src/config/environment.factory.ts`, `libs/platform/nest/src/lifecycle/resource.provider.ts`, `libs/platform/nest/src/index.ts`, `libs/platform/nest/project.json`, `libs/platform/nest/tsconfig.json`, `libs/platform/nest/tsconfig.lib.json`, `test/nest-provider-composition.test.mjs` |

#### faixa-3 — branch `spec/federated-platform-architecture-refactor-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-067 | Refactor Identity Federation around NestJSBetterAuth providers | `gpt-5.6-sol` | high | `apps/identity-subgraph/src/main.ts`, `apps/identity-subgraph/src/app.module.ts`, `libs/identity/nest/src/identity.module.ts`, `libs/identity/nest/src/auth/better-auth.factory.ts`, `libs/identity/nest/src/auth/better-auth.module.ts`, `libs/identity/nest/src/auth/plugins/jwt-plugin.factory.ts`, `libs/identity/nest/src/auth/plugins/oauth-provider-plugin.factory.ts`, `libs/identity/nest/src/auth/registration.service.ts`, `libs/identity/nest/src/graphql/identity.resolver.ts`, `libs/identity/nest/src/index.ts`, `libs/identity/nest/project.json`, `libs/identity/nest/tsconfig.json`, `libs/identity/nest/tsconfig.lib.json`, `test/identity-federation-refactor.test.mjs` |

### Onda 2 — faixa-4 ∥ faixa-5 ∥ faixa-6

#### faixa-4 — branch `spec/federated-platform-architecture-refactor-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-068 | Reduce Gateway to authenticated federation composition | `gpt-5.6-sol` | high | `apps/gateway/src/main.ts`, `apps/gateway/src/app.module.ts`, `libs/gateway/nest/src/auth/auth-context.factory.ts`, `libs/gateway/nest/src/auth/token-verifier.service.ts`, `libs/gateway/nest/src/federation/authenticated-data-source.ts`, `libs/gateway/nest/src/gateway.module.ts`, `libs/gateway/nest/src/index.ts`, `libs/gateway/nest/project.json`, `libs/gateway/nest/tsconfig.json`, `libs/gateway/nest/tsconfig.lib.json`, `test/gateway-federation-refactor.test.mjs` |

#### faixa-5 — branch `spec/federated-platform-architecture-refactor-faixa-5` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-069 | Build the thin WordPress Federation adapter | `gpt-5.6-sol` | high | `apps/wordpress-federation/src/main.ts`, `apps/wordpress-federation/src/app.module.ts`, `apps/wordpress-federation/project.json`, `apps/wordpress-integration/compose.yaml`, `apps/wordpress-integration/marketplace-inventory.php`, `apps/wordpress-integration/scripts/install-plugins.sh`, `apps/wordpress-integration/scripts/publish-subgraph.mjs`, `libs/wordpress/nest/src/federation/wordpress-federation.module.ts`, `libs/wordpress/nest/src/federation/wpgraphql-client.service.ts`, `libs/wordpress/nest/src/federation/wpgraphql-auth.factory.ts`, `libs/wordpress/nest/src/index.ts`, `libs/wordpress/nest/project.json`, `libs/wordpress/nest/tsconfig.json`, `libs/wordpress/nest/tsconfig.lib.json`, `libs/contracts/graphql/wordpress/schema.graphql`, `test/wordpress-federation-refactor.test.mjs` |
| T-071 | Move order subscriptions outside the federation gateway | `gpt-5.6-sol` | high | `libs/wordpress/nest/src/subscriptions/order-event.resolver.ts`, `libs/wordpress/nest/src/subscriptions/order-event.service.ts`, `libs/wordpress/nest/src/subscriptions/subscription-auth.guard.ts`, `libs/wordpress/nest/src/subscriptions/graphql-sse.adapter.ts`, `libs/wordpress/nest/src/subscriptions/subscriptions.module.ts`, `libs/wordpress/nest/src/index.ts`, `test/order-subscription-refactor.test.mjs` |

#### faixa-6 — branch `spec/federated-platform-architecture-refactor-faixa-6` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-6`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-070 | Refactor Payment as a Spring GraphQL Federation bounded context | `gpt-5.6-sol` | high | `apps/payment-processor/build.gradle.kts`, `apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/domain/Payment.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/application/command/AuthorizePayment.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/application/command/AuthorizePaymentHandler.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/application/query/FindPayment.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/application/query/PaymentView.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/application/query/FindPaymentHandler.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/graphql/PaymentController.java`, `apps/payment-processor/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java`, `apps/payment-processor/src/main/resources/graphql/payment.graphqls`, `apps/payment-processor/src/test/java/dev/desafio/payment/PaymentFederationTest.java`, `libs/contracts/graphql/payment/schema.graphql` |

### Onda 3 — faixa-7 ∥ faixa-8

#### faixa-7 — branch `spec/federated-platform-architecture-refactor-faixa-7` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-7`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-072 | Integrate the five-app topology and retire obsolete runtimes | `gpt-5.6-sol` | high | `package.json`, `nx.json`, `tsconfig.base.json`, `compose.yaml`, `libs/contracts/graphql/supergraph.yaml`, `apps/identity-subgraph/project.json`, `apps/payment-processor/project.json`, `apps/gateway/project.json`, `apps/apollo-mcp/project.json`, `apps/e2e/src/environment.ts`, `test/five-app-topology.test.mjs` |

#### faixa-8 — branch `spec/federated-platform-architecture-refactor-faixa-8` — worktree `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-faixa-8`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-073 | Prove quality and document the architecture walkthrough | `gpt-5.6-sol` | high | `README.md`, `docs/knowledge/Mapa do Projeto.md`, `docs/runbooks/local-development.md`, `docs/runbooks/e2e.md`, `docs/evidence/federated-platform-refactor/review.md`, `test/federated-platform-quality.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/federated-platform-architecture-refactor` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify federated-platform-architecture-refactor` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/federated-platform-architecture-refactor/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano federated-platform-architecture-refactor --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa federated-platform-architecture-refactor T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo federated-platform-architecture-refactor --tabela   # a tabela de andamento
onp-spec resumo federated-platform-architecture-refactor            # o resumo em texto
```

