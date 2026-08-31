# Plano de execução — stabilize-typescript-editor

> gerado por `onp-spec plano` em 2026-08-31 13:58 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano stabilize-typescript-editor`

## Resumo — o que vai acontecer

- **2 tarefa(s) pendente(s)**: 2 em 1 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano stabilize-typescript-editor --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/stabilize-typescript-editor`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1

#### faixa-1 — branch `spec/stabilize-typescript-editor-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-stabilize-typescript-editor-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-083 | Add explicit application typecheck projects | `gpt-5.6-terra` | medium | `apps/gateway/project.json`, `apps/gateway/tsconfig.app.json`, `apps/identity-subgraph/project.json`, `apps/identity-subgraph/tsconfig.app.json`, `apps/wordpress-federation/project.json`, `apps/wordpress-federation/tsconfig.app.json`, `tsconfig.json`, `test/typescript-editor-stability.test.mjs` |
| T-084 | Lock language-specific import behavior | `gpt-5.6-luna` | low | `.vscode/settings.json`, `test/typescript-editor-stability.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/stabilize-typescript-editor` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify stabilize-typescript-editor` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/stabilize-typescript-editor/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-stabilize-typescript-editor-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano stabilize-typescript-editor --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa stabilize-typescript-editor T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo stabilize-typescript-editor --tabela   # a tabela de andamento
onp-spec resumo stabilize-typescript-editor            # o resumo em texto
```
