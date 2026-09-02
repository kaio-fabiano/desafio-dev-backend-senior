# Plano de execução — oauth-resource-server-auth

> gerado por `onp-spec plano` em 2026-09-02 19:41 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano oauth-resource-server-auth --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 4 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal (6 já concluída(s): T-133, T-134, T-135, T-136, T-137, T-138)
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/oauth-resource-server-auth`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-139 | Preserve OAuth request proof and separate scope authorization | `gpt-5.6-sol` | high |
| T-140 | Remove duplicated GraphQL authentication state and decorators | `gpt-5.6-sol` | high |
| T-141 | Consolidate Gateway verification on the shared OAuth service | `gpt-5.6-sol` | high |
| T-142 | Simplify Better Auth composition and close quality gates | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/oauth-resource-server-auth` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify oauth-resource-server-auth` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-oauth-resource-server-auth-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano oauth-resource-server-auth --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa oauth-resource-server-auth T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo oauth-resource-server-auth --tabela   # a tabela de andamento
onp-spec resumo oauth-resource-server-auth            # o resumo em texto
```
