# Plano de execução — milestone-4-payment-inventory-saga

> gerado por `onp-spec plano` em 2026-08-27 15:53 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-4-payment-inventory-saga --paralelizar T-030,T-032`

## Resumo — o que vai acontecer

- **7 tarefa(s) pendente(s)**: 2 em 2 faixa(s) paralela(s) + 5 sequencial(is) (1 já concluída(s): T-028)
- **seleção do usuário**: paralelizar só T-030, T-032 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-4-payment-inventory-saga --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-4-payment-inventory-saga`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2

#### faixa-1 — branch `spec/milestone-4-payment-inventory-saga-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-4-payment-inventory-saga-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-030 | Scaffold the Spring Boot payment processor and Nx Gradle targets | `gpt-5.6-terra` | medium | `package.json`, `pnpm-lock.yaml`, `nx.json`, `apps/payment-processor/settings.gradle.kts`, `apps/payment-processor/build.gradle.kts`, `apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java`, `apps/payment-processor/src/main/resources/application.yaml`, `apps/payment-processor/src/test/java/dev/desafio/payment/PaymentProcessorApplicationTest.java`, `test/milestone-4-nx-gradle.test.mjs` |

#### faixa-2 — branch `spec/milestone-4-payment-inventory-saga-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-4-payment-inventory-saga-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-032 | Implement the idempotent WooCommerce inventory worker | `gpt-5.6-terra` | medium | `apps/stock-worker/project.json`, `apps/stock-worker/src/inventory/inventory.service.ts`, `apps/stock-worker/src/inventory/woo-inventory.adapter.ts`, `apps/stock-worker/src/inventory/inbox.repository.ts`, `apps/stock-worker/src/main.ts`, `test/milestone-4-inventory-worker.test.mjs`, `test/milestone-4-inventory-redelivery.test.mjs` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-029 | Add RabbitMQ topology and confirmed Commerce outbox publishing | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-031 | Implement idempotent Card, Pix, and refund processing | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-033 | Implement monotonic Commerce saga transitions | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-034 | Wire services, databases, and graceful lifecycle in Compose | `gpt-5.6-terra` | medium | fora da seleção do usuário |
| T-035 | Assemble the Milestone 4 acceptance and operational gate | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-4-payment-inventory-saga` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-4-payment-inventory-saga` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-4-payment-inventory-saga-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-4-payment-inventory-saga --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-4-payment-inventory-saga T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-4-payment-inventory-saga --tabela   # a tabela de andamento
onp-spec resumo milestone-4-payment-inventory-saga            # o resumo em texto
```

