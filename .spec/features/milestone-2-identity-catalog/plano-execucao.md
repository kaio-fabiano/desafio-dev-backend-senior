# Plano de execução — milestone-2-identity-catalog

> gerado por `onp-spec plano` em 2026-08-27 05:17 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-2-identity-catalog --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 7 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/milestone-2-identity-catalog`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-014 | Pin identity dependencies and reproducible configuration | `gpt-5.6-sol` | high |
| T-015 | Validate tokens and derive the federated identity | `gpt-5.6-sol` | high |
| T-016 | Link registration to WordPress consistently | `gpt-5.6-sol` | high |
| T-017 | Enforce supplier-company ownership | `gpt-5.6-sol` | high |
| T-018 | Publish the native Woo catalog through federation | `gpt-5.6-terra` | medium |
| T-019 | Batch federated catalog references per request | `gpt-5.6-terra` | medium |
| T-020 | Assemble the Milestone 2 gateway gate | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-2-identity-catalog` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify milestone-2-identity-catalog` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-2-identity-catalog/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-2-identity-catalog-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-2-identity-catalog --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-2-identity-catalog T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-2-identity-catalog --tabela   # a tabela de andamento
onp-spec resumo milestone-2-identity-catalog            # o resumo em texto
```

