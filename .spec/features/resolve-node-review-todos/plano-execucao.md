# Plano de execução — resolve-node-review-todos

> gerado por `onp-spec plano` em 2026-09-05 07:06 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano resolve-node-review-todos --paralelizar T-184,T-185,T-186,T-187,T-188,T-189`

## Resumo — o que vai acontecer

- **8 tarefa(s) pendente(s)**: 6 em 3 faixa(s) paralela(s) + 2 sequencial(is)
- **seleção do usuário**: paralelizar só T-184, T-185, T-186, T-187, T-188, T-189 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano resolve-node-review-todos --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/resolve-node-review-todos`; levar para a main é decisão sua

### Avisos

- ⚠ T-183 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-184 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-185 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-186 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-187 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-188 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-189 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar
- ⚠ T-190 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/resolve-node-review-todos-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-184 | Resolve gateway authentication, federation and loader findings | `gpt-5.6-sol` | high | `apps/gateway/src/app.module.ts`, `apps/gateway/src/health.controller.ts`, `apps/gateway/src/main.ts`, `libs/gateway/nest/src/auth/auth-context.factory.ts`, `libs/gateway/nest/src/auth/token-verifier.service.ts`, `libs/gateway/nest/src/federation/authenticated-data-source.ts`, `libs/gateway/nest/src/gateway.module.ts`, `docs/reviews/gateway-auth-refactor.md`, `libs/gateway/nest/src/index.ts`, `libs/platform/nest/src/index.ts`, `libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts`, `test/gateway-auth-review-ledger.test.mjs`, `.spec/features/gateway-auth-review-ledger/spec.md`, `.spec/features/gateway-auth-review-ledger/tasks.md`, `apps/gateway/src/subscriptions/order-workflow-subscription.client.ts`, `apps/gateway/src/subscriptions/sse-handler.ts`, `apps/gateway/src/subscriptions/sse.middleware.ts`, `docs/evidence/node-review/T-184.md`, `libs/gateway/nest/src/auth/auth-context.factory.spec.ts`, `libs/gateway/nest/src/auth/gateway-context.spec.ts`, `libs/gateway/nest/src/auth/gateway-context.ts`, `libs/gateway/nest/src/auth/gateway-request.adapter.spec.ts`, `libs/gateway/nest/src/auth/gateway-request.adapter.ts`, `libs/gateway/nest/src/auth/token-verifier.service.spec.ts`, `libs/gateway/nest/src/federation/authenticated-data-source.spec.ts`, `libs/gateway/nest/src/gateway-path.integration.spec.ts`, `libs/gateway/nest/src/gateway.module.spec.ts`, `libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.spec.ts`, `test/fixtures/catalog-loaders.ts`, `test/gateway-federation-refactor.test.mjs`, `test/milestone-6-mcp-propagation.test.mjs`, `test/milestone-7-load.test.mjs`, `test/resolve-gateway-sse-todos.test.mjs`, `test/structural-gateway-review.test.mjs` |

#### faixa-2 — branch `spec/resolve-node-review-todos-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-185 | Resolve Better Auth lifecycle, registration and resource scopes | `gpt-5.6-sol` | high | `libs/identity/nest/src/auth/better-auth.factory.ts`, `libs/identity/nest/src/auth/better-auth.module.ts`, `libs/identity/nest/src/auth/registration.service.ts`, `libs/identity/nest/src/auth/resource-audiences.ts`, `libs/identity/nest/src/identity.module.ts`, `docs/evidence/node-review/T-185.md`, `libs/identity/nest/src/auth/better-auth.factory.spec.ts`, `libs/identity/nest/src/auth/better-auth.module.integration.spec.ts`, `libs/identity/nest/src/auth/identity-auth.error.ts`, `libs/identity/nest/src/auth/registration.service.spec.ts`, `test/identity-federation-refactor.test.mjs`, `test/oauth-resource-server-auth.spec.test.mjs` |
| T-186 | Consolidate identity application, GraphQL and legacy consumers | `gpt-5.6-terra` | medium | `apps/identity-subgraph/project.json`, `apps/identity-subgraph/src/app.module.ts`, `apps/identity-subgraph/src/health.controller.ts`, `apps/identity-subgraph/src/main.ts`, `libs/identity/nest/src/auth/better-auth.factory.spec.ts`, `libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts`, `libs/identity/nest/src/graphql/identity.resolver.spec.ts`, `libs/identity/nest/src/graphql/identity.resolver.ts`, `libs/identity/nest/src/graphql/user.loader.ts`, `libs/identity/nest/src/graphql/user.repository.ts`, `libs/identity/nest/src/identity.module.ts`, `libs/identity/nest/src/index.ts`, `test/fixtures/identity-supplier.ts`, `test/graphql-relay-dataloader-closure.test.mjs`, `test/identity-federation-refactor.test.mjs`, `test/milestone-6-mcp-oauth.test.mjs`, `test/milestone-8-identity-gateway.test.mjs`, `docs/evidence/node-review/T-186.md` |

#### faixa-3 — branch `spec/resolve-node-review-todos-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-187 | Resolve checkout, command hashing and persistence findings | `gpt-5.6-sol` | high | `apps/order-workflow-subgraph/src/checkout/checkout.repository.ts`, `apps/order-workflow-subgraph/src/checkout/checkout.service.ts`, `apps/order-workflow-subgraph/src/checkout/command-hash.ts`, `apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts`, `apps/order-workflow-subgraph/src/checkout/woo-checkout.port.ts`, `apps/order-workflow-subgraph/src/persistence/entities/checkout-operation.entity.ts`, `apps/order-workflow-subgraph/src/persistence/entities/inbox-record.entity.ts`, `apps/order-workflow-subgraph/src/persistence/entities/order-workflow.entity.ts`, `apps/order-workflow-subgraph/src/persistence/entities/outbox-event.entity.ts`, `apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts`, `apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts`, `apps/order-workflow-subgraph/src/checkout/checkout.service.spec.ts`, `apps/order-workflow-subgraph/src/checkout/command-hash.spec.ts`, `apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.spec.ts`, `docs/evidence/node-review/T-187.md`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202608270001.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202608270002.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202608280001.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202608280002.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010001.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010002.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010003.ts`, `apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010004.ts` |
| T-188 | Resolve inbox, outbox, messaging and saga findings | `gpt-5.6-sol` | high | `apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts`, `apps/order-workflow-subgraph/src/checkout/checkout.repository.ts`, `apps/order-workflow-subgraph/src/inbox/inbox.repository.ts`, `apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.spec.ts`, `apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts`, `apps/order-workflow-subgraph/src/messaging/rabbitmq.integration.spec.ts`, `apps/order-workflow-subgraph/src/messaging/rabbitmq.spec.ts`, `apps/order-workflow-subgraph/src/messaging/rabbitmq.ts`, `apps/order-workflow-subgraph/src/outbox/outbox.publisher.spec.ts`, `apps/order-workflow-subgraph/src/outbox/outbox.publisher.ts`, `apps/order-workflow-subgraph/src/outbox/outbox.repository.ts`, `apps/order-workflow-subgraph/src/saga/order-event.consumer.integration.spec.ts`, `apps/order-workflow-subgraph/src/saga/order-event.consumer.ts`, `apps/order-workflow-subgraph/src/saga/order-saga.spec.ts`, `apps/order-workflow-subgraph/src/saga/order-saga.ts`, `docs/evidence/node-review/T-188.md` |
| T-189 | Resolve workflow GraphQL, bootstrap and SSE findings | `gpt-5.6-sol` | high | `apps/order-workflow-subgraph/src/graphql/authenticated-subject.decorator.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.tokens.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.types.ts`, `apps/order-workflow-subgraph/src/health.controller.ts`, `apps/order-workflow-subgraph/src/main.ts`, `apps/order-workflow-subgraph/src/subscriptions/mikro-orm-order-event.replay.ts`, `apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.ts`, `apps/order-workflow-subgraph/src/subscriptions/sse-handler.ts`, `apps/order-workflow-subgraph/src/subscriptions/sse.middleware.ts`, `apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.spec.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.module.spec.ts`, `apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.spec.ts`, `apps/order-workflow-subgraph/src/health.controller.spec.ts`, `apps/order-workflow-subgraph/src/subscriptions/mikro-orm-order-event.replay.spec.ts`, `apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.spec.ts`, `apps/order-workflow-subgraph/src/subscriptions/sse-handler.spec.ts`, `apps/order-workflow-subgraph/src/subscriptions/sse.integration.spec.ts`, `apps/order-workflow-subgraph/src/subscriptions/sse.middleware.spec.ts`, `docs/evidence/node-review/T-189.md`, `apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts`, `apps/order-workflow-subgraph/src/subscriptions/order-event.channel.ts` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-183 | Prepare decorator runtime, test ownership and coverage | `gpt-5.6-terra` | medium | fora da seleção do usuário |
| T-190 | Integrate corrections and close every review finding with evidence | `gpt-5.6-terra` | medium | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/resolve-node-review-todos` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify resolve-node-review-todos` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/resolve-node-review-todos/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano resolve-node-review-todos --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa resolve-node-review-todos T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo resolve-node-review-todos --tabela   # a tabela de andamento
onp-spec resumo resolve-node-review-todos            # o resumo em texto
```
