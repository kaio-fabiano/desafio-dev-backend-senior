#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano harden-oauth-runtime-configuration` em 2026-09-10 18:47
# NÃO edite à mão: mudou tasks.md ou a config, regenere o plano.
#
# uso:
#   bash executar-tarefas.sh                  tudo (ondas → sequenciais → gate)
#   bash executar-tarefas.sh --faixa <id>     reexecuta UMA faixa (+ merge + gate)
#   bash executar-tarefas.sh --seq <T-xxx>    reexecuta UMA tarefa sequencial
#   bash executar-tarefas.sh --gate           só o gate (verify + audit)
#   bash executar-tarefas.sh --listar         mostra faixas, tarefas e estados
#   (acrescente --sem-gate para não rodar o gate ao final)
#
# resumo do que está rolando, a qualquer momento: onp-spec resumo harden-oauth-runtime-configuration
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-auth-payment-fixes-harden-oauth-runtime-configuration-mtvvq49w'
FEATURE='harden-oauth-runtime-configuration'
BASE_BRANCH='spec/harden-oauth-runtime-configuration'
ENGINE='.agents/skills/onp-spec-driven/scripts/onp-spec.mjs'
CODEX_FLAGS=(--sandbox 'danger-full-access')
STREAM_FLAGS=(--json)
FALHAS=""
COM_GATE=1
RESUMO_MODEL='gpt-5.6-luna'
RESUMO_PID=""

verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$*"; }
info()     { printf '· %s\n' "$*"; }
falhar()   { vermelho "✘ $*"; exit 1; }

# eventos vão para o ledger GLOBAL (~/.onp-spec/painel/ledger.jsonl):
# um arquivo para todos os projetos, é o que o onp-spec resumo lê
evento() { node "$ENGINE" evento --run "$RUN_ID" "$@" >/dev/null 2>&1 || true; }

# ── ambiente (todos os modos passam por aqui) ────────────────────────
preparar_ambiente() {
  command -v git >/dev/null 2>&1 || falhar "git não encontrado"
  command -v node >/dev/null 2>&1 || falhar "node não encontrado"
  command -v codex >/dev/null 2>&1 || falhar "Codex CLI (codex) não encontrado — instale-o ou siga o modo manual em plano-execucao.md"
  TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || falhar "fora de um repositório git"
  cd "$TOPLEVEL" || exit 1
  # artefatos recém-gerados pelo `onp-spec plano` são sujeira esperada:
  # se forem a ÚNICA sujeira, o script mesmo commita; qualquer outra, aborta
  if [ -n "$(git status --porcelain)" ]; then
    if [ -z "$(git status --porcelain | grep -v -e 'plano-execucao\.' -e 'plano\.json' -e 'executar-tarefas\.sh')" ]; then
      git add -A
      git commit -q -m "plano de execução: $FEATURE (artefatos gerados)"
      info "artefatos do plano commitados"
    else
      falhar "árvore suja além dos artefatos do plano — commite ou faça git stash antes (os worktrees partem do último commit)"
    fi
  fi
  git ls-files --error-unmatch -- '.spec/features/harden-oauth-runtime-configuration/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
  ATUAL=$(git rev-parse --abbrev-ref HEAD)
  [ "$ATUAL" != "HEAD" ] || falhar "HEAD destacado — troque para uma branch"
  if [ "$ATUAL" != "$BASE_BRANCH" ]; then
    if git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
      git checkout -q "$BASE_BRANCH" || falhar "não consegui trocar para $BASE_BRANCH"
    else
      git checkout -q -b "$BASE_BRANCH" || falhar "não consegui criar $BASE_BRANCH"
    fi
    info "branch de trabalho: $BASE_BRANCH (a partir de $ATUAL)"
  fi
  git worktree prune
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-auth-payment-fixes-harden-oauth-runtime-configuration-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-auth-payment-fixes-harden-oauth-runtime-configuration"
  STREAMS_DIR="${ONP_SPEC_HOME:-$HOME/.onp-spec}/painel/streams/$RUN_ID"
  mkdir -p "$LOG_DIR" "$STREAMS_DIR"
}

# worktree limpo mesmo depois de uma tentativa que falhou
preparar_worktree() { # $1=faixa $2=branch $3=worktree
  git worktree prune
  if [ -e "$3" ]; then git worktree remove --force "$3" >/dev/null 2>&1; rm -rf "$3"; fi
  if git show-ref --verify --quiet "refs/heads/$2"; then git branch -D "$2" >/dev/null 2>&1; fi
  git worktree add "$3" -b "$2" >/dev/null 2>&1 || { vermelho "✘ não consegui criar o worktree de $1 em $3"; return 1; }
}

tentativa() { # $1=faixa — conta reexecuções (vai para o ledger)
  local arq="$LOG_DIR/.tentativa-$1"
  local n=1
  [ -f "$arq" ] && n=$(( $(cat "$arq") + 1 ))
  printf "%s" "$n" > "$arq"
  printf "%s" "$n"
}

# uma tarefa = uma sessão codex exec headless com contexto limpo.
# o JSONL da sessão vira o stream da tarefa no ledger
rodar_tarefa() { # $1=escopo(faixa|seq) $2=T-xxx $3=prompt $4=modelo $5=esforço
  local chave="$1--$2"
  local stream="$STREAMS_DIR/$chave.jsonl"
  evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado executando --stream "$chave"
  info "$2 — codex exec ($4 · $5) · stream: $chave"
  # --add-dir: o .git compartilhado dos worktrees mora no repo principal —
  # sem ele o sandbox workspace-write bloquearia o commit da tarefa
  if codex exec "$3" --model "$4" -c model_reasoning_effort="$5" "${STREAM_FLAGS[@]}" "${CODEX_FLAGS[@]}" --add-dir "$TOPLEVEL" > "$stream" 2>>"$LOG_DIR/$1.log"; then
    evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado concluida --stream "$chave"
    node "$ENGINE" stream-resumo "$RUN_ID" "$chave" 2>/dev/null || true
    return 0
  fi
  evento --tipo tarefa --tarefa "$2" --faixa "$1" --estado falhou --stream "$chave"
  node "$ENGINE" stream-resumo "$RUN_ID" "$chave" 2>/dev/null || true
  return 1
}

mesclar_faixa() { # $1=faixa $2=branch $3=worktree $4=exit-da-faixa
  if [ "$4" -ne 0 ]; then
    evento --tipo faixa --faixa "$1" --estado falhou
    vermelho "✘ $1 falhou (log: $LOG_DIR/$1.log) — worktree mantido para inspeção: $3"
    amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --faixa $1"
    FALHAS="$FALHAS $1"; return 1
  fi
  evento --tipo faixa --faixa "$1" --estado mesclando
  if git merge --no-ff "$2" -m "merge $1 ($FEATURE)"; then
    git worktree remove --force "$3" >/dev/null 2>&1
    git branch -d "$2" >/dev/null 2>&1
    evento --tipo faixa --faixa "$1" --estado mesclada
    verde "✔ $1 mesclada em $BASE_BRANCH"
  else
    git merge --abort >/dev/null 2>&1
    evento --tipo faixa --faixa "$1" --estado conflito
    vermelho "✘ conflito ao mesclar $1 — resolva na mão: git merge $2 (worktree mantido: $3)"
    FALHAS="$FALHAS $1"; return 1
  fi
}

marcar_concluidas() { # $@=T-xxx
  for t in "$@"; do node "$ENGINE" tarefa "$FEATURE" "$t" concluida >/dev/null || true; done
}

# ── resumo geral de andamento: 1/min enquanto a execução roda ─────────
# escrito por IA (codex exec somente leitura) com fallback do motor; vai
# para o terminal e para o ledger — o agente repassa o texto no chat.
gerar_resumo() {
  local ctx ia
  ctx=$(node "$ENGINE" resumo "$FEATURE" --contexto 2>/dev/null) || ctx=""
  [ -n "$ctx" ] || return 0
  ia=$(codex exec "Você narra, para o dono do produto, uma execução de tarefas de código em andamento. Estado mecânico:

$ctx

Escreva o RESUMO GERAL DE ANDAMENTO: um parágrafo único de 2 a 4 frases, em português simples, dizendo o que está acontecendo agora, o que já terminou, o que falhou e se o usuário precisa agir. Sem markdown, sem listas." --model "$RESUMO_MODEL" --sandbox read-only --ephemeral 2>/dev/null)
  if [ -n "$ia" ]; then
    node "$ENGINE" resumo "$FEATURE" --gravar --origem ia --texto "$ia" >/dev/null 2>&1 || true
    printf '\n📣 resumo (IA): %s\n' "$ia"
  else
    node "$ENGINE" resumo "$FEATURE" --gravar >/dev/null 2>&1 || true
    printf '\n📣 resumo: %s\n' "$(node "$ENGINE" resumo "$FEATURE" 2>/dev/null)"
  fi
}

# mata o loop E o sleep filho — senão o sleep herda o stdout e quem chamou
# o script via pipe fica esperando EOF por até 60s depois do exit
parar_resumos() {
  [ -n "$RESUMO_PID" ] || return 0
  command -v pkill >/dev/null 2>&1 && pkill -P "$RESUMO_PID" 2>/dev/null
  kill "$RESUMO_PID" 2>/dev/null
  RESUMO_PID=""
}

iniciar_resumos() {
  ( while :; do sleep 60; gerar_resumo; done ) &
  RESUMO_PID=$!
  # ao sair: para o loop e grava um último resumo (o estado final, do motor)
  trap 'parar_resumos; node "$ENGINE" resumo "$FEATURE" --gravar >/dev/null 2>&1 || true' EXIT
}

# ── sequencial T-268 (ordem do tasks.md) ──
executar_seq_T_268() {
  info 'sequencial T-268 — Align OAuth defaults and resolve configuration lazily'
  if rodar_tarefa seq 'T-268' 'Você executa UMA tarefa da feature "harden-oauth-runtime-configuration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/harden-oauth-runtime-configuration/spec.md, .spec/features/harden-oauth-runtime-configuration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-268 — "Align OAuth defaults and resolve configuration lazily"
  critérios/refs: AC-305 (Resolve compatible issuer configuration after Nest config loading)
  arquivos permitidos (e seus testes): libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, libs/gateway/nest/src/auth/gateway-auth.module.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/identity/nest/src/identity.module.ts, test/harden-oauth-runtime-configuration.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-268.md
  mensagem de commit: "T-268 harden-oauth-runtime-configuration: Align OAuth defaults and resolve configuration lazily"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-268 harden-oauth-runtime-configuration: Align OAuth defaults and resolve configuration lazily (auto-commit do plano)'
    fi
    marcar_concluidas T-268
    verde "✔ T-268 concluída"
    return 0
  fi
  vermelho "✘ T-268 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --seq T-268"
  FALHAS="$FALHAS T-268"
  return 1
}

# ── sequencial T-269 (ordem do tasks.md) ──
executar_seq_T_269() {
  info 'sequencial T-269 — Separate OAuth request orchestration from vendor verification'
  if rodar_tarefa seq 'T-269' 'Você executa UMA tarefa da feature "harden-oauth-runtime-configuration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/harden-oauth-runtime-configuration/spec.md, .spec/features/harden-oauth-runtime-configuration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-269 — "Separate OAuth request orchestration from vendor verification"
  critérios/refs: AC-308 (Separate OAuth orchestration from Better Auth verification)
  arquivos permitidos (e seus testes): libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.integration.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, test/harden-oauth-resource-service.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-269.md
  mensagem de commit: "T-269 harden-oauth-runtime-configuration: Separate OAuth request orchestration from vendor verification"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-269 harden-oauth-runtime-configuration: Separate OAuth request orchestration from vendor verification (auto-commit do plano)'
    fi
    marcar_concluidas T-269
    verde "✔ T-269 concluída"
    return 0
  fi
  vermelho "✘ T-269 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --seq T-269"
  FALHAS="$FALHAS T-269"
  return 1
}

# ── sequencial T-270 (ordem do tasks.md) ──
executar_seq_T_270() {
  info 'sequencial T-270 — Add canonical and replay-safe Gateway DPoP configuration'
  if rodar_tarefa seq 'T-270' 'Você executa UMA tarefa da feature "harden-oauth-runtime-configuration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/harden-oauth-runtime-configuration/spec.md, .spec/features/harden-oauth-runtime-configuration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-270 — "Add canonical and replay-safe Gateway DPoP configuration"
  critérios/refs: AC-306 (Reserve DPoP proof identifiers atomically across instances), AC-307 (Deploy canonical origin and shared replay storage)
  arquivos permitidos (e seus testes): package.json, pnpm-lock.yaml, infra/sst.config.ts, libs/platform/nest/src/oauth-resource/oauth-resource.types.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.spec.ts, libs/gateway/nest/src/auth/gateway-auth.module.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/gateway/nest/src/infrastructure/auth/dynamo-dpop-replay.store.ts, libs/gateway/nest/src/infrastructure/auth/dynamo-dpop-replay.store.spec.ts, test/production-deployment.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-270.md
  mensagem de commit: "T-270 harden-oauth-runtime-configuration: Add canonical and replay-safe Gateway DPoP configuration"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-270 harden-oauth-runtime-configuration: Add canonical and replay-safe Gateway DPoP configuration (auto-commit do plano)'
    fi
    marcar_concluidas T-270
    verde "✔ T-270 concluída"
    return 0
  fi
  vermelho "✘ T-270 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --seq T-270"
  FALHAS="$FALHAS T-270"
  return 1
}

# ── sequencial T-271 (ordem do tasks.md) ──
executar_seq_T_271() {
  info 'sequencial T-271 — Enforce Identity query visibility and use the production batch provider'
  if rodar_tarefa seq 'T-271' 'Você executa UMA tarefa da feature "harden-oauth-runtime-configuration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/harden-oauth-runtime-configuration/spec.md, .spec/features/harden-oauth-runtime-configuration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-271 — "Enforce Identity query visibility and use the production batch provider"
  critérios/refs: AC-309 (Restrict the user list to an administrative scope), AC-310 (Hide other users from point lookup and federation references), AC-311 (Exercise the production request-scoped batch provider), AC-312 (Report previous pages from persisted rows)
  arquivos permitidos (e seus testes): libs/identity/nest/src/application/policies/identity-user-visibility.policy.ts, libs/identity/nest/src/application/policies/identity-user-visibility.policy.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-resources.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/graphql/identity.resolver.spec.ts, libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts, libs/identity/nest/src/infrastructure/persistence/better-auth-identity-user.adapter.ts, libs/identity/nest/src/infrastructure/persistence/better-auth-identity-user.adapter.spec.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/graphql/user.loader.ts, libs/identity/nest/src/graphql/user.repository.ts, test/graphql-relay-dataloader-closure.test.mjs, test/identity-federation-refactor.test.mjs, test/idiomatic-nestjs-architecture.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-271.md
  mensagem de commit: "T-271 harden-oauth-runtime-configuration: Enforce Identity query visibility and use the production batch provider"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-271 harden-oauth-runtime-configuration: Enforce Identity query visibility and use the production batch provider (auto-commit do plano)'
    fi
    marcar_concluidas T-271
    verde "✔ T-271 concluída"
    return 0
  fi
  vermelho "✘ T-271 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --seq T-271"
  FALHAS="$FALHAS T-271"
  return 1
}

# ── sequencial T-272 (ordem do tasks.md) ──
executar_seq_T_272() {
  info 'sequencial T-272 — Correct OAuth audience and DPoP presentation guidance'
  if rodar_tarefa seq 'T-272' 'Você executa UMA tarefa da feature "harden-oauth-runtime-configuration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/harden-oauth-runtime-configuration/spec.md, .spec/features/harden-oauth-runtime-configuration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-272 — "Correct OAuth audience and DPoP presentation guidance"
  critérios/refs: AC-313 (Document the Identity audience for federated user operations)
  arquivos permitidos (e seus testes): README.md, docs/prds/03-identidade-e-oauth.md, docs/evidence/harden-oauth-runtime-configuration/presentation.md, test/harden-oauth-runtime-configuration.test.mjs
  mensagem de commit: "T-272 harden-oauth-runtime-configuration: Correct OAuth audience and DPoP presentation guidance"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-272 harden-oauth-runtime-configuration: Correct OAuth audience and DPoP presentation guidance (auto-commit do plano)'
    fi
    marcar_concluidas T-272
    verde "✔ T-272 concluída"
    return 0
  fi
  vermelho "✘ T-272 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --seq T-272"
  FALHAS="$FALHAS T-272"
  return 1
}

# ── gate: quem decide é a máquina ────────────────────────────────────
rodar_gate() {
  echo
  info "gate: verify + audit --ci"
  evento --tipo gate --etapa inicio
  node "$ENGINE" verify "$FEATURE"
  local v=$?
  evento --tipo gate --etapa verify --exit "$v"
  node "$ENGINE" audit --ci
  AUDIT=$?
  evento --tipo gate --etapa audit --exit "$AUDIT"
  # fecha a contabilidade: status das tarefas + prova do verify no git
  if [ -n "$(git status --porcelain -- '.spec')" ]; then
    git add -A -- '.spec'
    git commit -q -m "$FEATURE: status das tarefas + prova do verify (plano)"
    info "status das tarefas e prova do verify commitados"
  fi
  return "$AUDIT"
}

encerrar() { # $1=escopo
  echo
  if [ -n "$FALHAS" ]; then vermelho "faixas/tarefas com falha:$FALHAS"; fi
  # sem gate não existe veredito: NUNCA anunciar alinhamento sem o audit
  if [ "$COM_GATE" -eq 0 ]; then
    evento --tipo fim --exit 1 --escopo "$1"
    if [ -z "$FALHAS" ]; then
      amarelo "○ trabalho de '$1' terminou SEM o gate (--sem-gate) — isto NÃO é prova de nada"
      amarelo "  para o veredito: bash .spec/features/harden-oauth-runtime-configuration/executar-tarefas.sh --gate"
      exit 0
    fi
    vermelho "e ainda há falhas — conserte e rode o gate"
    exit 1
  fi
  rodar_gate
  local audit=$?
  if [ "$audit" -eq 0 ] && [ -z "$FALHAS" ]; then
    evento --tipo fim --exit 0 --escopo "$1"
    verde "✔ plano concluído — especificação e código alinhados (audit exit 0) na branch $BASE_BRANCH"
    info "próximo passo: revise e leve para a main quando quiser (git merge $BASE_BRANCH)"
    exit 0
  fi
  evento --tipo fim --exit 1 --escopo "$1"
  vermelho "plano terminou com pendências — leia a saída do audit acima e os logs em $LOG_DIR"
  amarelo "dica: reexecute só o que falhou (--faixa <id> / --seq <T-xxx>)"
  exit 1
}

executar_tudo() {
  evento --tipo inicio --escopo tudo
  iniciar_resumos
  info "logs em: $LOG_DIR"
  info "resumo geral de andamento: a cada 1 min aqui no terminal (e via: onp-spec resumo)"
  executar_seq_T_268 || true
  executar_seq_T_269 || true
  executar_seq_T_270 || true
  executar_seq_T_271 || true
  executar_seq_T_272 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-268 (sequencial)"
  echo "  seq       T-269 (sequencial)"
  echo "  seq       T-270 (sequencial)"
  echo "  seq       T-271 (sequencial)"
  echo "  seq       T-272 (sequencial)"
  echo
  echo "reexecutar uma faixa:    --faixa <id>"
  echo "reexecutar sequencial:   --seq <T-xxx>"
  echo "só o gate:               --gate"
}

MODO="tudo"
ALVO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --listar) MODO="listar" ;;
    --gate) MODO="gate" ;;
    --sem-gate) COM_GATE=0 ;;
    --faixa) MODO="faixa"; ALVO="${2:-}"; shift ;;
    --seq) MODO="seq"; ALVO="${2:-}"; shift ;;
    -h|--help) sed -n "2,14p" "$0"; exit 0 ;;
    *) vermelho "argumento desconhecido: $1"; sed -n "2,14p" "$0"; exit 2 ;;
  esac
  shift
done

if [ "$MODO" = "listar" ]; then listar; exit 0; fi

preparar_ambiente

case "$MODO" in
  tudo) executar_tudo ;;
  gate) COM_GATE=1; iniciar_resumos; encerrar gate ;;
  faixa)
    case "$ALVO" in
      *) falhar "faixa desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
  seq)
    case "$ALVO" in
      T-268) evento --tipo inicio --escopo "seq:T-268"; iniciar_resumos; executar_seq_T_268 || true; encerrar "seq:T-268" ;;
      T-269) evento --tipo inicio --escopo "seq:T-269"; iniciar_resumos; executar_seq_T_269 || true; encerrar "seq:T-269" ;;
      T-270) evento --tipo inicio --escopo "seq:T-270"; iniciar_resumos; executar_seq_T_270 || true; encerrar "seq:T-270" ;;
      T-271) evento --tipo inicio --escopo "seq:T-271"; iniciar_resumos; executar_seq_T_271 || true; encerrar "seq:T-271" ;;
      T-272) evento --tipo inicio --escopo "seq:T-272"; iniciar_resumos; executar_seq_T_272 || true; encerrar "seq:T-272" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
