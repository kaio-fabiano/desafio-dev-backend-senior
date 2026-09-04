# Plano de execução — mercado-pago-production-deployment

> gerado por `onp-spec plano` em 2026-09-04 04:01 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano mercado-pago-production-deployment --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 4 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal (10 já concluída(s): T-146, T-147, T-148, T-150, T-151, T-152, T-153, T-154, T-156, T-158)
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/mercado-pago-production-deployment`; levar para a main é decisão sua

### Avisos

- ⚠ T-159 está [em-andamento] — entrou no plano; se já houver trabalho local, commite antes de executar

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-149 | Deploy the approved stage and run release smoke tests | `gpt-5.6-sol` | high |
| T-157 | Synchronize sandbox secrets and generate the reviewed SST diff | `gpt-5.6-sol` | high |
| T-159 | Replace public load balancers with managed HTTPS routing | `gpt-5.6-sol` | high |
| T-160 | Repair sandbox container startup and readiness | `gpt-5.6-sol` | high |

## Gestão de branches e commits

1. branch de trabalho `spec/mercado-pago-production-deployment` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify mercado-pago-production-deployment` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/mercado-pago-production-deployment/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-mercado-pago-production-deployment-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano mercado-pago-production-deployment --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa mercado-pago-production-deployment T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo mercado-pago-production-deployment --tabela   # a tabela de andamento
onp-spec resumo mercado-pago-production-deployment            # o resumo em texto
```

