# Plano de execução — align-milestone-7-checkout-contract

> gerado por `onp-spec plano` em 2026-09-11 13:59 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano align-milestone-7-checkout-contract --paralelizar T-303,T-304`

## Resumo — o que vai acontecer

- **3 tarefa(s) pendente(s)**: 2 em 2 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-303, T-304 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano align-milestone-7-checkout-contract --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/align-milestone-7-checkout-contract`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2

#### faixa-1 — branch `spec/align-milestone-7-checkout-contract-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-align-milestone-7-checkout-contract-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-303 | Align Gateway and E2E checkout operation shapes | `gpt-5.6-sol` | high | `libs/contracts/graphql/order-workflow/schema.graphql`, `apps/e2e/src/journey.ts`, `apps/e2e/src/milestone-7.e2e.test.ts`, `test/milestone-7-e2e-contract.test.mjs` |

#### faixa-2 — branch `spec/align-milestone-7-checkout-contract-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-align-milestone-7-checkout-contract-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-304 | Register production checkout query handlers deterministically | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/edge/configuration/GraphQlReadConfiguration.java`, `apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-305 | Authenticate native WooCommerce checkout as the linked buyer | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/align-milestone-7-checkout-contract` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify align-milestone-7-checkout-contract` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/align-milestone-7-checkout-contract/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-align-milestone-7-checkout-contract-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano align-milestone-7-checkout-contract --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa align-milestone-7-checkout-contract T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo align-milestone-7-checkout-contract --tabela   # a tabela de andamento
onp-spec resumo align-milestone-7-checkout-contract            # o resumo em texto
```

