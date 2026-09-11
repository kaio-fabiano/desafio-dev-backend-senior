# Plano de execução — organize-payment-federation-structure

> gerado por `onp-spec plano` em 2026-09-11 11:47 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano organize-payment-federation-structure --sequencial --modelo gpt-5.6-luna --esforco low`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 3 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal (5 já concluída(s): T-277, T-278, T-279, T-280, T-281)
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- **custo travado pelo usuário**: modelo `gpt-5.6-luna` · esforço `low` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/organize-payment-federation-structure`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-276 | Codify the Java architecture allowance and failing structure gates | `gpt-5.6-luna` | low |
| T-282 | Place CQRS messages in their owning layers | `gpt-5.6-luna` | low |
| T-301 | Repair merged structure and active redelivery coverage | `gpt-5.6-luna` | low |

## Gestão de branches e commits

1. branch de trabalho `spec/organize-payment-federation-structure` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify organize-payment-federation-structure` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/organize-payment-federation-structure/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-organize-payment-federation-structure-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano organize-payment-federation-structure --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa organize-payment-federation-structure T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo organize-payment-federation-structure --tabela   # a tabela de andamento
onp-spec resumo organize-payment-federation-structure            # o resumo em texto
```

