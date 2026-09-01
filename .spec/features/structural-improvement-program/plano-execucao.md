# Plano de execução — structural-improvement-program

> gerado por `onp-spec plano` em 2026-09-01 01:28 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano structural-improvement-program`

## Resumo — o que vai acontecer

- **8 tarefa(s) pendente(s)**: 8 em 8 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano structural-improvement-program --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/structural-improvement-program`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/structural-improvement-program-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-1`

| tarefa | título                                | modelo        | esforço | arquivos                                                                       |
| ------ | ------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------ |
| T-092  | Review and improve Gateway boundaries | `gpt-5.6-sol` | high    | `apps/gateway`, `libs/gateway/nest`, `test/structural-gateway-review.test.mjs` |

#### faixa-2 — branch `spec/structural-improvement-program-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-2`

| tarefa | título                                 | modelo        | esforço | arquivos                                                                                   |
| ------ | -------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------ |
| T-093  | Review and improve Identity boundaries | `gpt-5.6-sol` | high    | `apps/identity-subgraph`, `libs/identity/nest`, `test/structural-identity-review.test.mjs` |

#### faixa-3 — branch `spec/structural-improvement-program-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-3`

| tarefa | título                                          | modelo        | esforço | arquivos                                                             |
| ------ | ----------------------------------------------- | ------------- | ------- | -------------------------------------------------------------------- |
| T-094  | Review and improve Commerce workflow boundaries | `gpt-5.6-sol` | high    | `apps/commerce-subgraph`, `test/structural-commerce-review.test.mjs` |

### Onda 2 — faixa-4 ∥ faixa-5 ∥ faixa-6

#### faixa-4 — branch `spec/structural-improvement-program-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-4`

| tarefa | título                                | modelo        | esforço | arquivos                                                            |
| ------ | ------------------------------------- | ------------- | ------- | ------------------------------------------------------------------- |
| T-095  | Review and improve Payment boundaries | `gpt-5.6-sol` | high    | `apps/payment-processor`, `test/structural-payment-review.test.mjs` |

#### faixa-5 — branch `spec/structural-improvement-program-faixa-5` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-5`

| tarefa | título                                   | modelo          | esforço | arquivos                                                                  |
| ------ | ---------------------------------------- | --------------- | ------- | ------------------------------------------------------------------------- |
| T-096  | Review and improve WordPress integration | `gpt-5.6-terra` | medium  | `apps/wordpress-integration`, `test/structural-wordpress-review.test.mjs` |

#### faixa-6 — branch `spec/structural-improvement-program-faixa-6` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-6`

| tarefa | título                                   | modelo          | esforço | arquivos                                                 |
| ------ | ---------------------------------------- | --------------- | ------- | -------------------------------------------------------- |
| T-097  | Review and improve Apollo MCP boundaries | `gpt-5.6-terra` | medium  | `apps/apollo-mcp`, `test/structural-mcp-review.test.mjs` |

### Onda 3 — faixa-7 ∥ faixa-8

#### faixa-7 — branch `spec/structural-improvement-program-faixa-7` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-7`

| tarefa | título                                    | modelo          | esforço | arquivos                                                                                                                                     |
| ------ | ----------------------------------------- | --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| T-098  | Review shared platform and infrastructure | `gpt-5.6-terra` | medium  | `libs/platform/nest`, `compose.yaml`, `nx.json`, `package.json`, `tsconfig.base.json`, `.github`, `test/structural-platform-review.test.mjs` |

#### faixa-8 — branch `spec/structural-improvement-program-faixa-8` — worktree `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-faixa-8`

| tarefa | título                                          | modelo         | esforço | arquivos                                                                                                                         |
| ------ | ----------------------------------------------- | -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| T-099  | Reconcile end-to-end evidence and documentation | `gpt-5.6-luna` | low     | `apps/e2e`, `README.md`, `docs`, `.spec/features/structural-improvement-program`, `test/structural-improvement-program.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/structural-improvement-program` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify structural-improvement-program` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/structural-improvement-program/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-structural-improvement-program-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano structural-improvement-program --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa structural-improvement-program T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo structural-improvement-program --tabela   # a tabela de andamento
onp-spec resumo structural-improvement-program            # o resumo em texto
```
