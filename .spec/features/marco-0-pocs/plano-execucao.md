# Plano de execução — marco-0-pocs

> gerado por `onp-spec plano` em 2026-08-26 14:19 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano marco-0-pocs --paralelizar T-004,T-005,T-006`

## Resumo — o que vai acontecer

- **4 tarefa(s) pendente(s)**: 3 em 3 faixa(s) paralela(s) + 1 sequencial(is) (1 já concluída(s): T-003)
- **seleção do usuário**: paralelizar só T-004, T-005, T-006 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano marco-0-pocs --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/marco-0-pocs`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/marco-0-pocs-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-marco-0-pocs-faixa-1`

| tarefa | título                                        | modelo        | esforço | arquivos                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-004  | Validate graphql-sse in the federated gateway | `gpt-5.6-sol` | high    | `apps/poc-sse/package.json`, `apps/poc-sse/tsconfig.json`, `apps/poc-sse/src/gateway.ts`, `apps/poc-sse/src/subgraph.ts`, `apps/poc-sse/src/probe.ts`, `apps/poc-sse/project.json`, `test/marco-0-sse.test.mjs`, `docs/adrs/001-graphql-sse-federado.md` |

#### faixa-2 — branch `spec/marco-0-pocs-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-marco-0-pocs-faixa-2`

| tarefa | título                                                | modelo        | esforço | arquivos                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------- | ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-005  | Validate the Better Auth token at the gateway and MCP | `gpt-5.6-sol` | high    | `apps/poc-auth/package.json`, `apps/poc-auth/tsconfig.json`, `apps/poc-auth/src/auth-server.ts`, `apps/poc-auth/src/resource-servers.ts`, `apps/poc-auth/src/probe.ts`, `apps/poc-auth/project.json`, `test/marco-0-auth.test.mjs`, `docs/adrs/002-oauth-multi-resource.md` |

#### faixa-3 — branch `spec/marco-0-pocs-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-marco-0-pocs-faixa-3`

| tarefa | título                                | modelo        | esforço | arquivos                                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-006  | Validate WordPress plugin composition | `gpt-5.6-sol` | high    | `apps/poc-wordpress/package.json`, `apps/poc-wordpress/project.json`, `apps/poc-wordpress/compose.yaml`, `apps/poc-wordpress/scripts/install-plugins.sh`, `apps/poc-wordpress/scripts/probe.mjs`, `apps/poc-wordpress/fixtures/products.json`, `test/marco-0-wordpress.test.mjs`, `docs/adrs/003-wordpress-federation.md` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título                                        | modelo         | esforço | por que sequencial         |
| ------ | --------------------------------------------- | -------------- | ------- | -------------------------- |
| T-007  | Pin versions, deadline, and decisions in ADRs | `gpt-5.6-luna` | low     | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/marco-0-pocs` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify marco-0-pocs` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/marco-0-pocs/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-marco-0-pocs-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano marco-0-pocs --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa marco-0-pocs T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo marco-0-pocs --tabela   # a tabela de andamento
onp-spec resumo marco-0-pocs            # o resumo em texto
```
