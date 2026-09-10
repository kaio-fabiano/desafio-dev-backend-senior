# Plano de execução — harden-oauth-runtime-configuration

> gerado por `onp-spec plano` em 2026-09-10 18:47 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano harden-oauth-runtime-configuration --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 5 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/harden-oauth-runtime-configuration`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-268 | Align OAuth defaults and resolve configuration lazily | `gpt-5.6-sol` | high |
| T-269 | Separate OAuth request orchestration from vendor verification | `gpt-5.6-sol` | high |
| T-270 | Add canonical and replay-safe Gateway DPoP configuration | `gpt-5.6-sol` | high |
| T-271 | Enforce Identity query visibility and use the production batch provider | `gpt-5.6-sol` | high |
| T-272 | Correct OAuth audience and DPoP presentation guidance | `gpt-5.6-luna` | low |

## Gestão de branches e commits

1. branch de trabalho `spec/harden-oauth-runtime-configuration` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify harden-oauth-runtime-configuration` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-auth-payment-fixes-harden-oauth-runtime-configuration-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano harden-oauth-runtime-configuration --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa harden-oauth-runtime-configuration T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo harden-oauth-runtime-configuration --tabela   # a tabela de andamento
onp-spec resumo harden-oauth-runtime-configuration            # o resumo em texto
```

