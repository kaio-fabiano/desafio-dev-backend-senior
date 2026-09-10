# Plano de execução — standardize-error-messages

> gerado por `onp-spec plano` em 2026-09-10 14:53 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano standardize-error-messages --paralelizar T-261,T-262,T-263,T-264,T-265,T-266,T-267`

## Resumo — o que vai acontecer

- **8 tarefa(s) pendente(s)**: 7 em 7 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-261, T-262, T-263, T-264, T-265, T-266, T-267 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano standardize-error-messages --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/standardize-error-messages`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3 ∥ faixa-4 ∥ faixa-5 ∥ faixa-6 ∥ faixa-7

#### faixa-1 — branch `spec/standardize-error-messages-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-261 | Standardize Gateway TypeScript errors | `gpt-5.6-sol` | high | `test/error-message-gateway.test.mjs`, `apps/gateway/src`, `libs/gateway/nest/src` |

#### faixa-2 — branch `spec/standardize-error-messages-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-262 | Standardize Java Transaction errors | `gpt-5.6-sol` | high | `test/error-message-java-transaction.test.mjs`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction` |

#### faixa-3 — branch `spec/standardize-error-messages-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-263 | Standardize Java Inventory errors | `gpt-5.6-sol` | high | `test/error-message-java-inventory.test.mjs`, `apps/payment-federation/src/main/java/dev/desafio/transaction/inventory` |

#### faixa-4 — branch `spec/standardize-error-messages-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-264 | Standardize Java Payment errors | `gpt-5.6-sol` | high | `test/error-message-java-payment.test.mjs`, `apps/payment-federation/src/main/java/dev/desafio/transaction/payment` |

#### faixa-5 — branch `spec/standardize-error-messages-faixa-5` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-265 | Standardize Java shared-boundary errors | `gpt-5.6-sol` | high | `test/error-message-java-shared.test.mjs`, `apps/payment-federation/src/main/java/dev/desafio/transaction/contracts`, `apps/payment-federation/src/main/java/dev/desafio/transaction/shared`, `apps/payment-federation/src/main/java/dev/desafio/transaction/migration` |

#### faixa-6 — branch `spec/standardize-error-messages-faixa-6` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-6`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-266 | Standardize Identity TypeScript errors | `gpt-5.6-sol` | high | `test/error-message-identity.test.mjs`, `apps/identity-subgraph/src`, `libs/identity/nest/src` |

#### faixa-7 — branch `spec/standardize-error-messages-faixa-7` — worktree `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-faixa-7`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-267 | Standardize Platform OAuth TypeScript errors | `gpt-5.6-sol` | high | `test/error-message-platform-oauth.test.mjs`, `libs/platform/nest/src` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-260 | Add final executable error-message governance | `gpt-5.6-terra` | medium | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/standardize-error-messages` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify standardize-error-messages` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/standardize-error-messages/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-standardize-error-messages-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano standardize-error-messages --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa standardize-error-messages T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo standardize-error-messages --tabela   # a tabela de andamento
onp-spec resumo standardize-error-messages            # o resumo em texto
```

