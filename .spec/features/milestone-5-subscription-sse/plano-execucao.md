# Plano de execução — milestone-5-subscription-sse

> gerado por `onp-spec plano` em 2026-08-27 17:11 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-5-subscription-sse --paralelizar T-037,T-038,T-039`

## Resumo — o que vai acontecer

- **4 tarefa(s) pendente(s)**: 3 em 3 faixa(s) paralela(s) + 1 sequencial(is) (1 já concluída(s): T-036)
- **seleção do usuário**: paralelizar só T-037, T-038, T-039 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-5-subscription-sse --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-5-subscription-sse`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/milestone-5-subscription-sse-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-5-subscription-sse-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-037 | Publish committed workflow transitions through RabbitMQ | `gpt-5.6-sol` | high | `apps/commerce-subgraph/src/saga/order-event.consumer.ts`, `apps/commerce-subgraph/src/subscriptions/order-transition.publisher.ts`, `apps/commerce-subgraph/src/messaging/rabbitmq.ts`, `libs/contracts/events/order-workflow-transitioned.v1.schema.json`, `test/milestone-5-transition-publication.test.mjs` |

#### faixa-2 — branch `spec/milestone-5-subscription-sse-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-5-subscription-sse-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-038 | Implement the authenticated Commerce SSE subscription source | `gpt-5.6-sol` | high | `apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts`, `apps/commerce-subgraph/src/subscriptions/order-event-broker.ts`, `apps/commerce-subgraph/src/graphql/commerce.module.ts`, `apps/commerce-subgraph/src/graphql/commerce.resolver.ts`, `test/milestone-5-commerce-subscription.test.mjs`, `test/milestone-5-subscription-lifecycle.test.mjs` |

#### faixa-3 — branch `spec/milestone-5-subscription-sse-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-5-subscription-sse-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-039 | Add the hybrid GraphQL SSE endpoint to the gateway | `gpt-5.6-sol` | high | `package.json`, `pnpm-lock.yaml`, `apps/gateway/src/app.module.ts`, `apps/gateway/src/main.ts`, `apps/gateway/src/subscriptions/sse-handler.ts`, `apps/gateway/src/subscriptions/commerce-subscription.client.ts`, `test/milestone-5-gateway-sse.test.mjs` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-040 | Assemble the Milestone 5 end-to-end acceptance gate | `gpt-5.6-terra` | medium | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-5-subscription-sse` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-5-subscription-sse` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-5-subscription-sse/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-5-subscription-sse-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-5-subscription-sse --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-5-subscription-sse T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-5-subscription-sse --tabela   # a tabela de andamento
onp-spec resumo milestone-5-subscription-sse            # o resumo em texto
```

