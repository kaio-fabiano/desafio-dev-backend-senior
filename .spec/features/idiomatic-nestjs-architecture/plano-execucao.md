# Plano de execução — idiomatic-nestjs-architecture

> gerado por `onp-spec plano` em 2026-09-08 03:59 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano idiomatic-nestjs-architecture --paralelizar T-225,T-226,T-227,T-228`

## Resumo — o que vai acontecer

- **5 tarefa(s) pendente(s)**: 4 em 4 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-225, T-226, T-227, T-228 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano idiomatic-nestjs-architecture --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/idiomatic-nestjs-architecture`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/idiomatic-nestjs-architecture-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-idiomatic-nestjs-architecture-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-225 | Align the executable DDD contract with NestJS injection | `gpt-5.6-sol` | high | `docs/standards/strict-nestjs-ddd.md`, `tools/architecture/strict-ddd-policy.mjs`, `tools/architecture/strict-ddd-scanner.mjs`, `test/strict-ddd-architecture.test.mjs`, `test/fixtures/strict-ddd` |

#### faixa-2 — branch `spec/idiomatic-nestjs-architecture-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-idiomatic-nestjs-architecture-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-226 | Make Identity use cases NestJS-managed providers | `gpt-5.6-sol` | high | `libs/identity/nest/src/application/use-cases`, `libs/identity/nest/src/identity.module.ts`, `libs/identity/nest/src/oauth-issuer`, `libs/identity/nest/src/registration`, `libs/identity/nest/src/identity-core.architecture.spec.ts`, `test/identity-federation-refactor.test.mjs`, `test/wordpress-registration-graphql.contract.test.mjs` |

#### faixa-3 — branch `spec/idiomatic-nestjs-architecture-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-idiomatic-nestjs-architecture-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-227 | Make OAuth verification a NestJS-managed use case | `gpt-5.6-sol` | high | `libs/platform/nest/src/oauth-resource/application/use-cases/verify-oauth-credential.use-case.ts`, `libs/platform/nest/src/oauth-resource/oauth-resource.module.ts`, `libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts`, `libs/platform/nest/src/oauth-resource/application/use-cases/verify-oauth-credential.use-case.spec.ts`, `libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts`, `libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts`, `test/oauth-resource-server-auth.spec.test.mjs`, `test/harden-oauth-resource-service.test.mjs` |

### Onda 2 — faixa-4

#### faixa-4 — branch `spec/idiomatic-nestjs-architecture-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-idiomatic-nestjs-architecture-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-228 | Make Gateway flows NestJS-managed providers | `gpt-5.6-sol` | high | `libs/gateway/nest/src/application/use-cases`, `libs/gateway/nest/src/auth`, `libs/gateway/nest/src/federation`, `libs/gateway/nest/src/gateway.module.ts`, `apps/gateway/src/app.module.ts`, `apps/gateway/src/subscriptions`, `test/gateway-federation-refactor.test.mjs` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-229 | Audit every NestJS module and close repository evidence | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/idiomatic-nestjs-architecture` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify idiomatic-nestjs-architecture` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/idiomatic-nestjs-architecture/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-idiomatic-nestjs-architecture-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano idiomatic-nestjs-architecture --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa idiomatic-nestjs-architecture T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo idiomatic-nestjs-architecture --tabela   # a tabela de andamento
onp-spec resumo idiomatic-nestjs-architecture            # o resumo em texto
```

