#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano strict-nestjs-ddd-migration` em 2026-09-07 19:20
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo strict-nestjs-ddd-migration
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-strict-nestjs-ddd-migration-mtrml2g6'
FEATURE='strict-nestjs-ddd-migration'
BASE_BRANCH='spec/strict-nestjs-ddd-migration'
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
  git ls-files --error-unmatch -- '.spec/features/strict-nestjs-ddd-migration/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-strict-nestjs-ddd-migration-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-strict-nestjs-ddd-migration"
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
    amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-216 (ordem do tasks.md) ──
executar_seq_T_216() {
  info 'sequencial T-216 — Replace the partial scanner with a truthful repository inventory'
  if rodar_tarefa seq 'T-216' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-216 — "Replace the partial scanner with a truthful repository inventory"
  critérios/refs: AC-260 (The inventory has only two application exclusions), AC-261 (Missing layers cannot produce a false zero)
  arquivos permitidos (e seus testes): tools/architecture, test/strict-ddd-architecture.test.mjs, test/fixtures/strict-ddd, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, .spec/constituicao.md, AGENTS.md
  mensagem de commit: "T-216 strict-nestjs-ddd-migration: Replace the partial scanner with a truthful repository inventory"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-216 strict-nestjs-ddd-migration: Replace the partial scanner with a truthful repository inventory (auto-commit do plano)'
    fi
    marcar_concluidas T-216
    verde "✔ T-216 concluída"
    return 0
  fi
  vermelho "✘ T-216 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-216"
  FALHAS="$FALHAS T-216"
  return 1
}

# ── sequencial T-217 (ordem do tasks.md) ──
executar_seq_T_217() {
  info 'sequencial T-217 — Extract the framework-independent Identity core'
  if rodar_tarefa seq 'T-217' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-217 — "Extract the framework-independent Identity core"
  critérios/refs: AC-256 (Dependency direction remains inward), AC-257 (Tactical DDD building blocks use focused classes), AC-262 (Identity domain and application are framework-independent), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): libs/identity, tools/architecture/strict-ddd-legacy-baseline.json
  mensagem de commit: "T-217 strict-nestjs-ddd-migration: Extract the framework-independent Identity core"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-217 strict-nestjs-ddd-migration: Extract the framework-independent Identity core (auto-commit do plano)'
    fi
    marcar_concluidas T-217
    verde "✔ T-217 concluída"
    return 0
  fi
  vermelho "✘ T-217 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-217"
  FALHAS="$FALHAS T-217"
  return 1
}

# ── sequencial T-218 (ordem do tasks.md) ──
executar_seq_T_218() {
  info 'sequencial T-218 — Rebuild Identity adapters, presentation, and NestJS composition'
  if rodar_tarefa seq 'T-218' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-218 — "Rebuild Identity adapters, presentation, and NestJS composition"
  critérios/refs: AC-263 (Identity adapters implement explicit ports), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): libs/identity/nest/src, apps/identity-subgraph/src, test/identity-federation-refactor.test.mjs, test/wordpress-registration-graphql.contract.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
  mensagem de commit: "T-218 strict-nestjs-ddd-migration: Rebuild Identity adapters, presentation, and NestJS composition"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-218 strict-nestjs-ddd-migration: Rebuild Identity adapters, presentation, and NestJS composition (auto-commit do plano)'
    fi
    marcar_concluidas T-218
    verde "✔ T-218 concluída"
    return 0
  fi
  vermelho "✘ T-218 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-218"
  FALHAS="$FALHAS T-218"
  return 1
}

# ── sequencial T-219 (ordem do tasks.md) ──
executar_seq_T_219() {
  info 'sequencial T-219 — Separate Platform authorization policy from NestJS adapters'
  if rodar_tarefa seq 'T-219' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-219 — "Separate Platform authorization policy from NestJS adapters"
  critérios/refs: AC-256 (Dependency direction remains inward), AC-257 (Tactical DDD building blocks use focused classes), AC-264 (Platform authorization policy has an inward dependency direction), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): libs/platform, test/oauth-resource-server-auth.spec.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
  mensagem de commit: "T-219 strict-nestjs-ddd-migration: Separate Platform authorization policy from NestJS adapters"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-219 strict-nestjs-ddd-migration: Separate Platform authorization policy from NestJS adapters (auto-commit do plano)'
    fi
    marcar_concluidas T-219
    verde "✔ T-219 concluída"
    return 0
  fi
  vermelho "✘ T-219 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-219"
  FALHAS="$FALHAS T-219"
  return 1
}

# ── sequencial T-220 (ordem do tasks.md) ──
executar_seq_T_220() {
  info 'sequencial T-220 — Refactor the Gateway as a thin Clean Architecture edge'
  if rodar_tarefa seq 'T-220' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-220 — "Refactor the Gateway as a thin Clean Architecture edge"
  critérios/refs: AC-256 (Dependency direction remains inward), AC-265 (Gateway remains a thin edge context), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): libs/gateway, apps/gateway/src, test/gateway-federation-refactor.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
  mensagem de commit: "T-220 strict-nestjs-ddd-migration: Refactor the Gateway as a thin Clean Architecture edge"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-220 strict-nestjs-ddd-migration: Refactor the Gateway as a thin Clean Architecture edge (auto-commit do plano)'
    fi
    marcar_concluidas T-220
    verde "✔ T-220 concluída"
    return 0
  fi
  vermelho "✘ T-220 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-220"
  FALHAS="$FALHAS T-220"
  return 1
}

# ── sequencial T-221 (ordem do tasks.md) ──
executar_seq_T_221() {
  info 'sequencial T-221 — Refactor the WordPress and WooCommerce integration'
  if rodar_tarefa seq 'T-221' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-221 — "Refactor the WordPress and WooCommerce integration"
  critérios/refs: AC-266 (The WordPress integration follows WordPress and WooCommerce boundaries), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): apps/wordpress-integration, test/wordpress-registration-graphql.contract.test.mjs, test/milestone-8-wordpress-inventory-plugin.test.mjs, test/structural-wordpress-review.test.mjs, test/wordpress-native-commerce.test.mjs
  mensagem de commit: "T-221 strict-nestjs-ddd-migration: Refactor the WordPress and WooCommerce integration"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-221 strict-nestjs-ddd-migration: Refactor the WordPress and WooCommerce integration (auto-commit do plano)'
    fi
    marcar_concluidas T-221
    verde "✔ T-221 concluída"
    return 0
  fi
  vermelho "✘ T-221 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-221"
  FALHAS="$FALHAS T-221"
  return 1
}

# ── sequencial T-222 (ordem do tasks.md) ──
executar_seq_T_222() {
  info 'sequencial T-222 — Govern shared contracts and Apollo MCP as explicit boundaries'
  if rodar_tarefa seq 'T-222' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-222 — "Govern shared contracts and Apollo MCP as explicit boundaries"
  critérios/refs: AC-267 (Technical boundaries remain technical), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): libs/contracts, apps/apollo-mcp, test/milestone-6-apollo-mcp.test.mjs, test/milestone-6-mcp-config.test.mjs, test/milestone-6-mcp-operations.test.mjs, test/structural-mcp-review.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
  mensagem de commit: "T-222 strict-nestjs-ddd-migration: Govern shared contracts and Apollo MCP as explicit boundaries"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-222 strict-nestjs-ddd-migration: Govern shared contracts and Apollo MCP as explicit boundaries (auto-commit do plano)'
    fi
    marcar_concluidas T-222
    verde "✔ T-222 concluída"
    return 0
  fi
  vermelho "✘ T-222 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-222"
  FALHAS="$FALHAS T-222"
  return 1
}

# ── sequencial T-223 (ordem do tasks.md) ──
executar_seq_T_223() {
  info 'sequencial T-223 — Refactor infrastructure, deployment scripts, and end-to-end tooling'
  if rodar_tarefa seq 'T-223' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-223 — "Refactor infrastructure, deployment scripts, and end-to-end tooling"
  critérios/refs: AC-267 (Technical boundaries remain technical), AC-268 (Each wave uses characterization-first TDD)
  arquivos permitidos (e seus testes): infra, apps/e2e, tools, scripts, test, package.json, nx.json, tsconfig.base.json, pnpm-workspace.yaml
  mensagem de commit: "T-223 strict-nestjs-ddd-migration: Refactor infrastructure, deployment scripts, and end-to-end tooling"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-223 strict-nestjs-ddd-migration: Refactor infrastructure, deployment scripts, and end-to-end tooling (auto-commit do plano)'
    fi
    marcar_concluidas T-223
    verde "✔ T-223 concluída"
    return 0
  fi
  vermelho "✘ T-223 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-223"
  FALHAS="$FALHAS T-223"
  return 1
}

# ── sequencial T-224 (ordem do tasks.md) ──
executar_seq_T_224() {
  info 'sequencial T-224 — Close the repository-wide baseline and publish migration evidence'
  if rodar_tarefa seq 'T-224' 'Você executa UMA tarefa da feature "strict-nestjs-ddd-migration" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/strict-nestjs-ddd-migration/spec.md, .spec/features/strict-nestjs-ddd-migration/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-224 — "Close the repository-wide baseline and publish migration evidence"
  critérios/refs: AC-258 (Every migration wave preserves contracts), AC-259 (The migration closes with zero legacy exceptions), AC-260 (The inventory has only two application exclusions), AC-261 (Missing layers cannot produce a false zero), AC-269 (Completion has no unclassified production code or legacy baseline)
  arquivos permitidos (e seus testes): tools/architecture/strict-ddd-legacy-baseline.json, test/strict-ddd-architecture.test.mjs, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, docs/prds/01-arquitetura-e-dominio.md, graphify-out, .spec/features/strict-nestjs-ddd-migration
  mensagem de commit: "T-224 strict-nestjs-ddd-migration: Close the repository-wide baseline and publish migration evidence"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-224 strict-nestjs-ddd-migration: Close the repository-wide baseline and publish migration evidence (auto-commit do plano)'
    fi
    marcar_concluidas T-224
    verde "✔ T-224 concluída"
    return 0
  fi
  vermelho "✘ T-224 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --seq T-224"
  FALHAS="$FALHAS T-224"
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
      amarelo "  para o veredito: bash .spec/features/strict-nestjs-ddd-migration/executar-tarefas.sh --gate"
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
  executar_seq_T_216 || true
  executar_seq_T_217 || true
  executar_seq_T_218 || true
  executar_seq_T_219 || true
  executar_seq_T_220 || true
  executar_seq_T_221 || true
  executar_seq_T_222 || true
  executar_seq_T_223 || true
  executar_seq_T_224 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-216 (sequencial)"
  echo "  seq       T-217 (sequencial)"
  echo "  seq       T-218 (sequencial)"
  echo "  seq       T-219 (sequencial)"
  echo "  seq       T-220 (sequencial)"
  echo "  seq       T-221 (sequencial)"
  echo "  seq       T-222 (sequencial)"
  echo "  seq       T-223 (sequencial)"
  echo "  seq       T-224 (sequencial)"
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
      T-216) evento --tipo inicio --escopo "seq:T-216"; iniciar_resumos; executar_seq_T_216 || true; encerrar "seq:T-216" ;;
      T-217) evento --tipo inicio --escopo "seq:T-217"; iniciar_resumos; executar_seq_T_217 || true; encerrar "seq:T-217" ;;
      T-218) evento --tipo inicio --escopo "seq:T-218"; iniciar_resumos; executar_seq_T_218 || true; encerrar "seq:T-218" ;;
      T-219) evento --tipo inicio --escopo "seq:T-219"; iniciar_resumos; executar_seq_T_219 || true; encerrar "seq:T-219" ;;
      T-220) evento --tipo inicio --escopo "seq:T-220"; iniciar_resumos; executar_seq_T_220 || true; encerrar "seq:T-220" ;;
      T-221) evento --tipo inicio --escopo "seq:T-221"; iniciar_resumos; executar_seq_T_221 || true; encerrar "seq:T-221" ;;
      T-222) evento --tipo inicio --escopo "seq:T-222"; iniciar_resumos; executar_seq_T_222 || true; encerrar "seq:T-222" ;;
      T-223) evento --tipo inicio --escopo "seq:T-223"; iniciar_resumos; executar_seq_T_223 || true; encerrar "seq:T-223" ;;
      T-224) evento --tipo inicio --escopo "seq:T-224"; iniciar_resumos; executar_seq_T_224 || true; encerrar "seq:T-224" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
