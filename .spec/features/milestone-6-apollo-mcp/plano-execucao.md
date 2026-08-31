# Plano de execução — milestone-6-apollo-mcp

> gerado por `onp-spec plano` em 2026-08-27 18:04 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-6-apollo-mcp`

## Resumo — o que vai acontecer

- **5 tarefa(s) pendente(s)**: 5 em 4 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-6-apollo-mcp --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-6-apollo-mcp`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/milestone-6-apollo-mcp-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-6-apollo-mcp-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-041 | Define the curated GraphQL operation manifest | `gpt-5.6-luna` | low | `apps/apollo-mcp/operations/me.graphql`, `apps/apollo-mcp/operations/search-products.graphql`, `apps/apollo-mcp/operations/get-product.graphql`, `apps/apollo-mcp/operations/get-my-cart.graphql`, `apps/apollo-mcp/operations/get-my-orders.graphql`, `apps/apollo-mcp/operations/add-to-cart.graphql`, `apps/apollo-mcp/operations/remove-from-cart.graphql`, `test/milestone-6-mcp-operations.test.mjs` |

#### faixa-2 — branch `spec/milestone-6-apollo-mcp-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-6-apollo-mcp-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-042 | Configure the official self-hosted Apollo MCP Server | `gpt-5.6-sol` | high | `apps/apollo-mcp/mcp.yaml`, `apps/apollo-mcp/Dockerfile`, `apps/apollo-mcp/project.json`, `docs/prds/08-riscos-e-decisoes-pendentes.md`, `test/milestone-6-mcp-config.test.mjs` |
| T-044 | Wire Apollo MCP to the gateway and Compose | `gpt-5.6-sol` | high | `compose.yaml`, `apps/gateway/src/main.ts`, `apps/apollo-mcp/mcp.yaml`, `test/milestone-6-mcp-propagation.test.mjs` |

#### faixa-3 — branch `spec/milestone-6-apollo-mcp-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-6-apollo-mcp-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-043 | Seed MCP OAuth resources and scoped client grants | `gpt-5.6-sol` | high | `apps/identity-subgraph/src/auth/config.ts`, `apps/identity-subgraph/src/auth/seed.ts`, `apps/poc-auth/src/auth-server.ts`, `test/milestone-6-mcp-oauth.test.mjs` |

### Onda 2 — faixa-4

#### faixa-4 — branch `spec/milestone-6-apollo-mcp-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-6-apollo-mcp-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-045 | Assemble MCP protocol and parity acceptance | `gpt-5.6-terra` | medium | `package.json`, `pnpm-lock.yaml`, `apps/poc-harness/project.json`, `test/milestone-6-apollo-mcp.test.mjs`, `docs/runbooks/milestone-6-apollo-mcp.md`, `docs/evidence/mcp/README.md`, `onpspec.config.json`, `.github/workflows/ci.yml` |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-6-apollo-mcp` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-6-apollo-mcp` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-6-apollo-mcp/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-6-apollo-mcp-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-6-apollo-mcp --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-6-apollo-mcp T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-6-apollo-mcp --tabela   # a tabela de andamento
onp-spec resumo milestone-6-apollo-mcp            # o resumo em texto
```

