# Plano de execução — stabilize-platform-nest-public-api

> gerado por `onp-spec plano` em 2026-09-05 02:10 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano stabilize-platform-nest-public-api --sequencial --modelo gpt-5.6-sol --esforco high`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 1 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- **custo travado pelo usuário**: modelo `gpt-5.6-sol` · esforço `high` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/stabilize-platform-nest-public-api`; levar para a main é decisão sua

### Avisos

- ⚠ T-182 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-182 | Stabilize the platform NestJS public API | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/stabilize-platform-nest-public-api` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify stabilize-platform-nest-public-api` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/stabilize-platform-nest-public-api/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-stabilize-platform-nest-public-api-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano stabilize-platform-nest-public-api --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa stabilize-platform-nest-public-api T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo stabilize-platform-nest-public-api --tabela   # a tabela de andamento
onp-spec resumo stabilize-platform-nest-public-api            # o resumo em texto
```

