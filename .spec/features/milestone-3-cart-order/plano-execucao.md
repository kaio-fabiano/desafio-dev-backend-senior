# Plano de execução — milestone-3-cart-order

> gerado por `onp-spec plano` em 2026-08-27 14:45 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-3-cart-order`

## Resumo — o que vai acontecer

- **7 tarefa(s) pendente(s)**: 7 em 7 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-3-cart-order --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-3-cart-order`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/milestone-3-cart-order-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-021 | Extend the schema-first commerce contract | `gpt-5.6-luna` | low | `libs/contracts/graphql/commerce/schema.graphql`, `libs/contracts/graphql/catalog/schema.graphql`, `libs/contracts/graphql/identity/schema.graphql`, `test/milestone-3-commerce-contract.test.mjs` |

#### faixa-2 — branch `spec/milestone-3-cart-order-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-022 | Adapt authenticated WooCommerce cart operations | `gpt-5.6-terra` | medium | `apps/commerce-subgraph/src/cart/woo-cart.port.ts`, `apps/commerce-subgraph/src/cart/woo-cart.adapter.ts`, `apps/commerce-subgraph/src/cart/cart.service.ts`, `test/milestone-3-cart.test.mjs` |

#### faixa-3 — branch `spec/milestone-3-cart-order-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-023 | Add MikroORM commerce persistence and migrations | `gpt-5.6-terra` | medium | `package.json`, `pnpm-lock.yaml`, `apps/commerce-subgraph/src/persistence/mikro-orm.config.ts`, `apps/commerce-subgraph/src/persistence/entities/checkout-operation.entity.ts`, `apps/commerce-subgraph/src/persistence/entities/order-workflow.entity.ts`, `apps/commerce-subgraph/src/persistence/entities/outbox-event.entity.ts`, `apps/commerce-subgraph/src/persistence/migrations/Migration202608270001.ts`, `test/milestone-3-migrations.test.mjs` |

### Onda 2 — faixa-4 ∥ faixa-5 ∥ faixa-6

#### faixa-4 — branch `spec/milestone-3-cart-order-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-024 | Implement concurrent idempotent checkout and recovery | `gpt-5.6-sol` | high | `apps/commerce-subgraph/src/checkout/command-hash.ts`, `apps/commerce-subgraph/src/checkout/checkout.service.ts`, `apps/commerce-subgraph/src/checkout/woo-order.port.ts`, `apps/commerce-subgraph/src/checkout/checkout.repository.ts`, `apps/commerce-subgraph/src/outbox/outbox.repository.ts`, `test/milestone-3-checkout-idempotency.test.mjs`, `test/milestone-3-checkout-recovery.test.mjs` |

#### faixa-5 — branch `spec/milestone-3-cart-order-faixa-5` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-025 | Integrate the idempotent WooCommerce order adapter | `gpt-5.6-terra` | medium | `apps/commerce-subgraph/src/checkout/woo-order.adapter.ts`, `apps/poc-wordpress/scripts/probe-checkout.mjs`, `test/milestone-3-wordpress-checkout.test.mjs`, `docs/adrs/006-woocommerce-idempotent-checkout.md` |

#### faixa-6 — branch `spec/milestone-3-cart-order-faixa-6` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-6`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-026 | Resolve cart, checkout, and workflow through federation | `gpt-5.6-terra` | medium | `apps/commerce-subgraph/src/graphql/commerce.module.ts`, `apps/commerce-subgraph/src/graphql/commerce.resolver.ts`, `apps/commerce-subgraph/src/app.module.ts`, `apps/gateway/src/catalog/order-loader.ts`, `apps/gateway/src/catalog/request-metrics.ts`, `test/milestone-3-federated-me.test.mjs` |

### Onda 3 — faixa-7

#### faixa-7 — branch `spec/milestone-3-cart-order-faixa-7` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-faixa-7`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-027 | Assemble the Milestone 3 acceptance gate | `gpt-5.6-sol` | high | `compose.yaml`, `onpspec.config.json`, `apps/commerce-subgraph/project.json`, `docs/runbooks/milestone-3-cart-order.md`, `test/milestone-3-cart-order.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-3-cart-order` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-3-cart-order` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-3-cart-order/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-3-cart-order-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-3-cart-order --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-3-cart-order T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-3-cart-order --tabela   # a tabela de andamento
onp-spec resumo milestone-3-cart-order            # o resumo em texto
```

