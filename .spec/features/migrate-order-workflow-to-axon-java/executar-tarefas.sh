#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano migrate-order-workflow-to-axon-java` em 2026-09-09 07:08
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo migrate-order-workflow-to-axon-java
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-mttrblj6'
FEATURE='migrate-order-workflow-to-axon-java'
BASE_BRANCH='spec/migrate-order-workflow-to-axon-java'
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
  git ls-files --error-unmatch -- '.spec/features/migrate-order-workflow-to-axon-java/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java"
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
    amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-244 (ordem do tasks.md) ──
executar_seq_T_244() {
  info 'sequencial T-244 — Prove the Axon 5 persistence and architecture baseline'
  if rodar_tarefa seq 'T-244' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-244 — "Prove the Axon 5 persistence and architecture baseline"
  critérios/refs: AC-280 (Java sources follow the approved boundaries), AC-282 (Axon state is durable and replayable), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/payment-federation/build.gradle.kts, apps/payment-federation/src/main/java/dev/desafio/transaction, apps/payment-federation/src/main/resources/application.yaml, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/architecture, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/axon, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/persistence
  mensagem de commit: "T-244 migrate-order-workflow-to-axon-java: Prove the Axon 5 persistence and architecture baseline"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-244 migrate-order-workflow-to-axon-java: Prove the Axon 5 persistence and architecture baseline (auto-commit do plano)'
    fi
    marcar_concluidas T-244
    verde "✔ T-244 concluída"
    return 0
  fi
  vermelho "✘ T-244 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-244"
  FALHAS="$FALHAS T-244"
  return 1
}

# ── sequencial T-245 (ordem do tasks.md) ──
executar_seq_T_245() {
  info 'sequencial T-245 — Establish versioned contracts and reliable AMQP boundaries'
  if rodar_tarefa seq 'T-245' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-245 — "Establish versioned contracts and reliable AMQP boundaries"
  critérios/refs: AC-280 (Java sources follow the approved boundaries), AC-293 (Bounded contexts communicate through RabbitMQ AMQP), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): libs/contracts/events, apps/payment-federation/src/main/java/dev/desafio/transaction/contracts/integration/v1, apps/payment-federation/src/main/java/dev/desafio/transaction/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction/*/infrastructure/messaging, apps/payment-federation/src/main/java/dev/desafio/transaction/*/infrastructure/persistence, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/contracts, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging
  mensagem de commit: "T-245 migrate-order-workflow-to-axon-java: Establish versioned contracts and reliable AMQP boundaries"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-245 migrate-order-workflow-to-axon-java: Establish versioned contracts and reliable AMQP boundaries (auto-commit do plano)'
    fi
    marcar_concluidas T-245
    verde "✔ T-245 concluída"
    return 0
  fi
  vermelho "✘ T-245 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-245"
  FALHAS="$FALHAS T-245"
  return 1
}

# ── sequencial T-246 (ordem do tasks.md) ──
executar_seq_T_246() {
  info 'sequencial T-246 — Convert Inventory into an independent Axon participant'
  if rodar_tarefa seq 'T-246' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-246 — "Convert Inventory into an independent Axon participant"
  critérios/refs: AC-281 (Commands, events, and queries have distinct paths), AC-282 (Axon state is durable and replayable), AC-284 (Inventory remains independently consistent), AC-293 (Bounded contexts communicate through RabbitMQ AMQP), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/inventory, apps/payment-federation/src/main/resources/db/migration/inventory, apps/payment-federation/src/test/java/dev/desafio/transaction/inventory
  mensagem de commit: "T-246 migrate-order-workflow-to-axon-java: Convert Inventory into an independent Axon participant"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-246 migrate-order-workflow-to-axon-java: Convert Inventory into an independent Axon participant (auto-commit do plano)'
    fi
    marcar_concluidas T-246
    verde "✔ T-246 concluída"
    return 0
  fi
  vermelho "✘ T-246 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-246"
  FALHAS="$FALHAS T-246"
  return 1
}

# ── sequencial T-247 (ordem do tasks.md) ──
executar_seq_T_247() {
  info 'sequencial T-247 — Convert Payment and provider effects into Axon'
  if rodar_tarefa seq 'T-247' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-247 — "Convert Payment and provider effects into Axon"
  critérios/refs: AC-281 (Commands, events, and queries have distinct paths), AC-282 (Axon state is durable and replayable), AC-283 (Payment invariants and provider idempotency survive conversion), AC-293 (Bounded contexts communicate through RabbitMQ AMQP), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/payment, apps/payment-federation/src/main/resources/db/migration/payment, apps/payment-federation/src/test/java/dev/desafio/transaction/payment
  mensagem de commit: "T-247 migrate-order-workflow-to-axon-java: Convert Payment and provider effects into Axon"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-247 migrate-order-workflow-to-axon-java: Convert Payment and provider effects into Axon (auto-commit do plano)'
    fi
    marcar_concluidas T-247
    verde "✔ T-247 concluída"
    return 0
  fi
  vermelho "✘ T-247 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-247"
  FALHAS="$FALHAS T-247"
  return 1
}

# ── sequencial T-248 (ordem do tasks.md) ──
executar_seq_T_248() {
  info 'sequencial T-248 — Migrate checkout and Transaction decisions'
  if rodar_tarefa seq 'T-248' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-248 — "Migrate checkout and Transaction decisions"
  critérios/refs: AC-281 (Commands, events, and queries have distinct paths), AC-282 (Axon state is durable and replayable), AC-285 (Checkout remains idempotent across concurrency and ambiguity), AC-286 (The distributed lifecycle is strictly choreographed), AC-293 (Bounded contexts communicate through RabbitMQ AMQP), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/checkout, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction, apps/payment-federation/src/main/resources/db/migration/transaction, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction
  mensagem de commit: "T-248 migrate-order-workflow-to-axon-java: Migrate checkout and Transaction decisions"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-248 migrate-order-workflow-to-axon-java: Migrate checkout and Transaction decisions (auto-commit do plano)'
    fi
    marcar_concluidas T-248
    verde "✔ T-248 concluída"
    return 0
  fi
  vermelho "✘ T-248 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-248"
  FALHAS="$FALHAS T-248"
  return 1
}

# ── sequencial T-249 (ordem do tasks.md) ──
executar_seq_T_249() {
  info 'sequencial T-249 — Build replayable projections and compatible GraphQL'
  if rodar_tarefa seq 'T-249' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-249 — "Build replayable projections and compatible GraphQL"
  critérios/refs: AC-281 (Commands, events, and queries have distinct paths), AC-287 (Transaction projections preserve observable state), AC-288 (Existing GraphQL operations remain compatible during cutover), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): libs/contracts/graphql/order-workflow/schema.graphql, apps/payment-federation/src/main/java/dev/desafio/transaction/*/application/query, apps/payment-federation/src/main/java/dev/desafio/transaction/*/infrastructure/persistence, apps/payment-federation/src/main/java/dev/desafio/transaction/*/interfaces/graphql, apps/payment-federation/src/main/resources/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/projection
  mensagem de commit: "T-249 migrate-order-workflow-to-axon-java: Build replayable projections and compatible GraphQL"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-249 migrate-order-workflow-to-axon-java: Build replayable projections and compatible GraphQL (auto-commit do plano)'
    fi
    marcar_concluidas T-249
    verde "✔ T-249 concluída"
    return 0
  fi
  vermelho "✘ T-249 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-249"
  FALHAS="$FALHAS T-249"
  return 1
}

# ── sequencial T-250 (ordem do tasks.md) ──
executar_seq_T_250() {
  info 'sequencial T-250 — Deliver transaction-filtered GraphQL SSE'
  if rodar_tarefa seq 'T-250' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-250 — "Deliver transaction-filtered GraphQL SSE"
  critérios/refs: AC-289 (Axon subscription queries isolate transaction updates), AC-288 (Existing GraphQL operations remain compatible during cutover), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql, apps/payment-federation/src/main/resources/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription, apps/gateway/src/subscriptions, apps/gateway/src/app.module.ts, apps/e2e/src, apps/wordpress-integration
  mensagem de commit: "T-250 migrate-order-workflow-to-axon-java: Deliver transaction-filtered GraphQL SSE"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-250 migrate-order-workflow-to-axon-java: Deliver transaction-filtered GraphQL SSE (auto-commit do plano)'
    fi
    marcar_concluidas T-250
    verde "✔ T-250 concluída"
    return 0
  fi
  vermelho "✘ T-250 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-250"
  FALHAS="$FALHAS T-250"
  return 1
}

# ── sequencial T-251 (ordem do tasks.md) ──
executar_seq_T_251() {
  info 'sequencial T-251 — Prove the complete choreographed lifecycle and compensations'
  if rodar_tarefa seq 'T-251' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-251 — "Prove the complete choreographed lifecycle and compensations"
  critérios/refs: AC-283 (Payment invariants and provider idempotency survive conversion), AC-284 (Inventory remains independently consistent), AC-286 (The distributed lifecycle is strictly choreographed), AC-287 (Transaction projections preserve observable state), AC-293 (Bounded contexts communicate through RabbitMQ AMQP), AC-292 (Repository quality gates prove the migration)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory, apps/payment-federation/src/main/java/dev/desafio/transaction/payment, apps/payment-federation/src/test/java/dev/desafio/transaction/e2e, apps/payment-federation/src/test/java/dev/desafio/transaction/architecture
  mensagem de commit: "T-251 migrate-order-workflow-to-axon-java: Prove the complete choreographed lifecycle and compensations"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-251 migrate-order-workflow-to-axon-java: Prove the complete choreographed lifecycle and compensations (auto-commit do plano)'
    fi
    marcar_concluidas T-251
    verde "✔ T-251 concluída"
    return 0
  fi
  vermelho "✘ T-251 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-251"
  FALHAS="$FALHAS T-251"
  return 1
}

# ── sequencial T-252 (ordem do tasks.md) ──
executar_seq_T_252() {
  info 'sequencial T-252 — Import or clean-start legacy state and perform reversible cutover'
  if rodar_tarefa seq 'T-252' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-252 — "Import or clean-start legacy state and perform reversible cutover"
  critérios/refs: AC-285 (Checkout remains idempotent across concurrency and ambiguity), AC-287 (Transaction projections preserve observable state), AC-288 (Existing GraphQL operations remain compatible during cutover), AC-289 (Axon subscription queries isolate transaction updates), AC-290 (Existing durable state has an explicit migration decision), AC-291 (One Java deployment becomes the sole owner), AC-292 (Repository quality gates prove the migration), AC-293 (Bounded contexts communicate through RabbitMQ AMQP)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/persistence, apps/payment-federation/src/main/java/dev/desafio/transaction/migration, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/migration, apps/gateway, compose.yaml, apps/e2e
  mensagem de commit: "T-252 migrate-order-workflow-to-axon-java: Import or clean-start legacy state and perform reversible cutover"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-252 migrate-order-workflow-to-axon-java: Import or clean-start legacy state and perform reversible cutover (auto-commit do plano)'
    fi
    marcar_concluidas T-252
    verde "✔ T-252 concluída"
    return 0
  fi
  vermelho "✘ T-252 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-252"
  FALHAS="$FALHAS T-252"
  return 1
}

# ── sequencial T-253 (ordem do tasks.md) ──
executar_seq_T_253() {
  info 'sequencial T-253 — Retire Node Workflow and close all quality gates'
  if rodar_tarefa seq 'T-253' 'Você executa UMA tarefa da feature "migrate-order-workflow-to-axon-java" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-253 — "Retire Node Workflow and close all quality gates"
  critérios/refs: AC-280 (Java sources follow the approved boundaries), AC-282 (Axon state is durable and replayable), AC-286 (The distributed lifecycle is strictly choreographed), AC-288 (Existing GraphQL operations remain compatible during cutover), AC-289 (Axon subscription queries isolate transaction updates), AC-290 (Existing durable state has an explicit migration decision), AC-291 (One Java deployment becomes the sole owner), AC-292 (Repository quality gates prove the migration), AC-293 (Bounded contexts communicate through RabbitMQ AMQP)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph, apps/gateway, apps/payment-federation, apps/wordpress-integration, libs/contracts, compose.yaml, README.md, docs, test, .spec/features/migrate-order-workflow-to-axon-java
  mensagem de commit: "T-253 migrate-order-workflow-to-axon-java: Retire Node Workflow and close all quality gates"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-253 migrate-order-workflow-to-axon-java: Retire Node Workflow and close all quality gates (auto-commit do plano)'
    fi
    marcar_concluidas T-253
    verde "✔ T-253 concluída"
    return 0
  fi
  vermelho "✘ T-253 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --seq T-253"
  FALHAS="$FALHAS T-253"
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
      amarelo "  para o veredito: bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh --gate"
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
  executar_seq_T_244 || true
  executar_seq_T_245 || true
  executar_seq_T_246 || true
  executar_seq_T_247 || true
  executar_seq_T_248 || true
  executar_seq_T_249 || true
  executar_seq_T_250 || true
  executar_seq_T_251 || true
  executar_seq_T_252 || true
  executar_seq_T_253 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-244 (sequencial)"
  echo "  seq       T-245 (sequencial)"
  echo "  seq       T-246 (sequencial)"
  echo "  seq       T-247 (sequencial)"
  echo "  seq       T-248 (sequencial)"
  echo "  seq       T-249 (sequencial)"
  echo "  seq       T-250 (sequencial)"
  echo "  seq       T-251 (sequencial)"
  echo "  seq       T-252 (sequencial)"
  echo "  seq       T-253 (sequencial)"
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
      T-244) evento --tipo inicio --escopo "seq:T-244"; iniciar_resumos; executar_seq_T_244 || true; encerrar "seq:T-244" ;;
      T-245) evento --tipo inicio --escopo "seq:T-245"; iniciar_resumos; executar_seq_T_245 || true; encerrar "seq:T-245" ;;
      T-246) evento --tipo inicio --escopo "seq:T-246"; iniciar_resumos; executar_seq_T_246 || true; encerrar "seq:T-246" ;;
      T-247) evento --tipo inicio --escopo "seq:T-247"; iniciar_resumos; executar_seq_T_247 || true; encerrar "seq:T-247" ;;
      T-248) evento --tipo inicio --escopo "seq:T-248"; iniciar_resumos; executar_seq_T_248 || true; encerrar "seq:T-248" ;;
      T-249) evento --tipo inicio --escopo "seq:T-249"; iniciar_resumos; executar_seq_T_249 || true; encerrar "seq:T-249" ;;
      T-250) evento --tipo inicio --escopo "seq:T-250"; iniciar_resumos; executar_seq_T_250 || true; encerrar "seq:T-250" ;;
      T-251) evento --tipo inicio --escopo "seq:T-251"; iniciar_resumos; executar_seq_T_251 || true; encerrar "seq:T-251" ;;
      T-252) evento --tipo inicio --escopo "seq:T-252"; iniciar_resumos; executar_seq_T_252 || true; encerrar "seq:T-252" ;;
      T-253) evento --tipo inicio --escopo "seq:T-253"; iniciar_resumos; executar_seq_T_253 || true; encerrar "seq:T-253" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
