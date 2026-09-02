# Plano de execução — payment-federation-clean-architecture

> gerado por `onp-spec plano` em 2026-09-02 14:29 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano payment-federation-clean-architecture --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 4 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/payment-federation-clean-architecture`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-129 | Migrate Payment into the canonical bounded context | `gpt-5.6-sol` | high |
| T-130 | Migrate Inventory and split Spring composition roots | `gpt-5.6-sol` | high |
| T-131 | Migrate tests and enforce architectural boundaries | `gpt-5.6-sol` | high |
| T-132 | Clean branch history and close both verification gates | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/payment-federation-clean-architecture` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify payment-federation-clean-architecture` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/payment-federation-clean-architecture/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-payment-federation-clean-architecture-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano payment-federation-clean-architecture --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa payment-federation-clean-architecture T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo payment-federation-clean-architecture --tabela   # a tabela de andamento
onp-spec resumo payment-federation-clean-architecture            # o resumo em texto
```
