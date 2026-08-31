# Plano de execução — delivery-closure

> gerado por `onp-spec plano` em 2026-08-31 15:29 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano delivery-closure --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 7 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/delivery-closure`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título                                                        | modelo          | esforço |
| ------ | ------------------------------------------------------------- | --------------- | ------- |
| T-085  | Encode the immutable challenge compliance gate                | `gpt-5.6-luna`  | low     |
| T-086  | Restore durable checkout and RabbitMQ choreography            | `gpt-5.6-sol`   | high    |
| T-087  | Reactivate the Java Payment Federation event runtime          | `gpt-5.6-sol`   | high    |
| T-088  | Add inventory reaction and compensation to Payment Federation | `gpt-5.6-sol`   | high    |
| T-089  | Repair the complete Testcontainers acceptance journey         | `gpt-5.6-sol`   | high    |
| T-090  | Add optional end-to-end observability                         | `gpt-5.6-sol`   | high    |
| T-091  | Reconcile documentation and close every gate                  | `gpt-5.6-terra` | medium  |

## Gestão de branches e commits

1. branch de trabalho `spec/delivery-closure` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify delivery-closure` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/delivery-closure/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-delivery-closure-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano delivery-closure --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa delivery-closure T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo delivery-closure --tabela   # a tabela de andamento
onp-spec resumo delivery-closure            # o resumo em texto
```
