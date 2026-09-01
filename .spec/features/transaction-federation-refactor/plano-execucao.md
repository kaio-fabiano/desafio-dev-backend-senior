# Plano de execução — transaction-federation-refactor

> gerado por `onp-spec plano` em 2026-09-01 22:16 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano transaction-federation-refactor --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 8 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/transaction-federation-refactor`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título                                             | modelo          | esforço |
| ------ | -------------------------------------------------- | --------------- | ------- |
| T-108  | Provar capacidades nativas e fronteiras            | `gpt-5.6-sol`   | high    |
| T-109  | Renomear Commerce para Order Workflow              | `gpt-5.6-terra` | medium  |
| T-110  | Remover wrappers e delegar ao WooGraphQL           | `gpt-5.6-sol`   | high    |
| T-111  | Simplificar saga e preservar SSE no Order Workflow | `gpt-5.6-sol`   | high    |
| T-112  | Isolar Payment, Inventory e porta de provedor      | `gpt-5.6-sol`   | high    |
| T-113  | Reconectar Gateway, MCP, compose e supergraph      | `gpt-5.6-sol`   | high    |
| T-114  | Registrar ADRs e plano do pagamento real           | `gpt-5.6-luna`  | low     |
| T-115  | Fechar E2E, ESLint, composição e auditoria         | `gpt-5.6-sol`   | high    |

## Gestão de branches e commits

1. branch de trabalho `spec/transaction-federation-refactor` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify transaction-federation-refactor` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/transaction-federation-refactor/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-transaction-federation-refactor-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano transaction-federation-refactor --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa transaction-federation-refactor T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo transaction-federation-refactor --tabela   # a tabela de andamento
onp-spec resumo transaction-federation-refactor            # o resumo em texto
```
