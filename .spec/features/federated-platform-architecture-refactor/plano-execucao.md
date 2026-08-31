# Plano de execução — federated-platform-architecture-refactor

> gerado por `onp-spec plano` em 2026-08-30 23:40 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano federated-platform-architecture-refactor --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 5 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal (9 já concluída(s): T-065, T-066, T-067, T-068, T-069, T-070, T-071, T-072, T-073)
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/federated-platform-architecture-refactor`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-074 | Replace the custom WordPress identity bridge with standard OIDC | `gpt-5.6-sol` | high |
| T-075 | Replace custom order and payment GraphQL operations with native owner APIs | `gpt-5.6-sol` | high |
| T-076 | Feed order subscriptions from native WooCommerce webhooks | `gpt-5.6-sol` | high |
| T-077 | Delete the marketplace MU-plugin and prove the plugin-first topology | `gpt-5.6-sol` | high |
| T-078 | Re-run acceptance and publish the native-plugin walkthrough | `gpt-5.6-luna` | low |

## Gestão de branches e commits

1. branch de trabalho `spec/federated-platform-architecture-refactor` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify federated-platform-architecture-refactor` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/federated-platform-architecture-refactor/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-federated-platform-architecture-refactor-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano federated-platform-architecture-refactor --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa federated-platform-architecture-refactor T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo federated-platform-architecture-refactor --tabela   # a tabela de andamento
onp-spec resumo federated-platform-architecture-refactor            # o resumo em texto
```

