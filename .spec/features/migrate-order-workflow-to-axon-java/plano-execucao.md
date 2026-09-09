# Plano de execução — migrate-order-workflow-to-axon-java

> gerado por `onp-spec plano` em 2026-09-09 18:27 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano migrate-order-workflow-to-axon-java --sequencial --modelo gpt-5.6-sol --esforco high`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 1 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal (13 já concluída(s): T-240, T-241, T-242, T-243, T-244, T-245, T-246, T-247, T-248, T-249, T-250, T-251, T-252)
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- **custo travado pelo usuário**: modelo `gpt-5.6-sol` · esforço `high` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/migrate-order-workflow-to-axon-java`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-253 | Retire Node Workflow and close all quality gates | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/migrate-order-workflow-to-axon-java` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify migrate-order-workflow-to-axon-java` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano migrate-order-workflow-to-axon-java --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa migrate-order-workflow-to-axon-java T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo migrate-order-workflow-to-axon-java --tabela   # a tabela de andamento
onp-spec resumo migrate-order-workflow-to-axon-java            # o resumo em texto
```

