# Plano de execução — organize-payment-federation-structure

> gerado por `onp-spec plano` em 2026-09-11 11:38 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano organize-payment-federation-structure --paralelizar T-276,T-277,T-282 --modelo gpt-5.6-luna --esforco low`

## Resumo — o que vai acontecer

- **3 tarefa(s) pendente(s)**: 3 em 2 faixa(s) paralela(s) + 0 sequencial(is) (4 já concluída(s): T-278, T-279, T-280, T-281)
- **seleção do usuário**: paralelizar só T-276, T-277, T-282 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano organize-payment-federation-structure --paralelizar T-xxx,T-yyy` ou `--sequencial`
- **custo travado pelo usuário**: modelo `gpt-5.6-luna` · esforço `low` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/organize-payment-federation-structure`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2

#### faixa-1 — branch `spec/organize-payment-federation-structure-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-organize-payment-federation-structure-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-276 | Codify the Java architecture allowance and failing structure gates | `gpt-5.6-luna` | low | `AGENTS.md`, `docs/domain/context-map.md`, `apps/payment-federation/src/test/java/dev/desafio/transaction/architecture/ContextArchitectureTest.java`, `test/organize-payment-federation-structure.test.mjs` |
| T-282 | Place CQRS messages in their owning layers | `gpt-5.6-luna` | low | `apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/event`, `apps/payment-federation/src/main/java/dev/desafio/transaction/payment/domain/event`, `apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/application/axon`, `apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/domain/event`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/event`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/domain/event`, `apps/payment-federation/src/test/java/dev/desafio/transaction/payment`, `apps/payment-federation/src/test/java/dev/desafio/transaction/inventory`, `apps/payment-federation/src/test/java/dev/desafio/transaction/transaction`, `test/organize-payment-federation-structure.test.mjs` |

#### faixa-2 — branch `spec/organize-payment-federation-structure-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-organize-payment-federation-structure-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-277 | Move GraphQL composition and checkout artifacts to their owners | `gpt-5.6-luna` | low | `apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql`, `apps/payment-federation/src/main/java/dev/desafio/transaction/edge`, `apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql`, `apps/payment-federation/src/main/java/dev/desafio/transaction/payment/interfaces/graphql`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/axon`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/checkout`, `apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentGraphqlConfiguration.java`, `apps/payment-federation/src/main/resources/graphql/payment.graphqls`, `apps/payment-federation/src/test/java/dev/desafio/transaction/graphql`, `apps/payment-federation/src/test/java/dev/desafio/transaction/subscription` |

## Gestão de branches e commits

1. branch de trabalho `spec/organize-payment-federation-structure` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify organize-payment-federation-structure` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/organize-payment-federation-structure/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-organize-payment-federation-structure-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano organize-payment-federation-structure --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa organize-payment-federation-structure T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo organize-payment-federation-structure --tabela   # a tabela de andamento
onp-spec resumo organize-payment-federation-structure            # o resumo em texto
```

