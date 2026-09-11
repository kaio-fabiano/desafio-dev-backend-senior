#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano refactor-checkout-operation-flow` em 2026-09-11 08:46
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo refactor-checkout-operation-flow
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-refactor-checkout-operation-flow-mtwpp386'
FEATURE='refactor-checkout-operation-flow'
BASE_BRANCH='spec/refactor-checkout-operation-flow'
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
  git ls-files --error-unmatch -- '.spec/features/refactor-checkout-operation-flow/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-refactor-checkout-operation-flow-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-refactor-checkout-operation-flow"
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
    amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-290 (ordem do tasks.md) ──
executar_seq_T_290() {
  info 'sequencial T-290 — Implement the durable race-safe checkout persistence slice'
  if rodar_tarefa seq 'T-290' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-290 — "Implement the durable race-safe checkout persistence slice"
  critérios/refs: AC-335 (Resolve the PostgreSQL creation race), AC-343 (Persist queryable operation outcomes), AC-348 (Remove checkout polling, leases, and ownership), AC-349 (Preserve meaningful operation states and retry behavior)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutIdempotencyConflictException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationEntity.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationJpaRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaCheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionReadRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionPersistenceMapper.java, apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
  mensagem de commit: "T-290 refactor-checkout-operation-flow: Implement the durable race-safe checkout persistence slice"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-290 refactor-checkout-operation-flow: Implement the durable race-safe checkout persistence slice (auto-commit do plano)'
    fi
    marcar_concluidas T-290
    verde "✔ T-290 concluída"
    return 0
  fi
  vermelho "✘ T-290 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-290"
  FALHAS="$FALHAS T-290"
  return 1
}

# ── sequencial T-293 (ordem do tasks.md) ──
executar_seq_T_293() {
  info 'sequencial T-293 — Return current checkout state and dispatch Transaction asynchronously'
  if rodar_tarefa seq 'T-293' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-293 — "Return current checkout state and dispatch Transaction asynchronously"
  critérios/refs: AC-334 (Reject reuse with a different semantic payload), AC-337 (Return operation state without synchronous checkout waiting), AC-339 (Create at most one internal Transaction for one checkout), AC-343 (Persist queryable operation outcomes), AC-348 (Remove checkout polling, leases, and ownership), AC-349 (Preserve meaningful operation states and retry behavior), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutBusyException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java
  mensagem de commit: "T-293 refactor-checkout-operation-flow: Return current checkout state and dispatch Transaction asynchronously"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-293 refactor-checkout-operation-flow: Return current checkout state and dispatch Transaction asynchronously (auto-commit do plano)'
    fi
    marcar_concluidas T-293
    verde "✔ T-293 concluída"
    return 0
  fi
  vermelho "✘ T-293 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-293"
  FALHAS="$FALHAS T-293"
  return 1
}

# ── sequencial T-294 (ordem do tasks.md) ──
executar_seq_T_294() {
  info 'sequencial T-294 — Preserve WooCommerce uncertain-result reconciliation'
  if rodar_tarefa seq 'T-294' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-294 — "Preserve WooCommerce uncertain-result reconciliation"
  critérios/refs: AC-340 (Commit WooCommerce creation-requested before create), AC-341 (Reconcile an unknown WooCommerce outcome without blind create), AC-342 (Keep one deterministic WooCommerce reference), AC-349 (Preserve meaningful operation states and retry behavior), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/WooCommerceOrderPort.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, docs/adrs/006-woocommerce-idempotent-checkout.md
  mensagem de commit: "T-294 refactor-checkout-operation-flow: Preserve WooCommerce uncertain-result reconciliation"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-294 refactor-checkout-operation-flow: Preserve WooCommerce uncertain-result reconciliation (auto-commit do plano)'
    fi
    marcar_concluidas T-294
    verde "✔ T-294 concluída"
    return 0
  fi
  vermelho "✘ T-294 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-294"
  FALHAS="$FALHAS T-294"
  return 1
}

# ── sequencial T-295 (ordem do tasks.md) ──
executar_seq_T_295() {
  info 'sequencial T-295 — Expose checkout operation through GraphQL mutation and query'
  if rodar_tarefa seq 'T-295' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-295 — "Expose checkout operation through GraphQL mutation and query"
  critérios/refs: AC-337 (Return operation state without synchronous checkout waiting), AC-343 (Persist queryable operation outcomes), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutGraphQlController.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/CheckoutOperationView.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperation.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperationHandler.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java
  mensagem de commit: "T-295 refactor-checkout-operation-flow: Expose checkout operation through GraphQL mutation and query"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-295 refactor-checkout-operation-flow: Expose checkout operation through GraphQL mutation and query (auto-commit do plano)'
    fi
    marcar_concluidas T-295
    verde "✔ T-295 concluída"
    return 0
  fi
  vermelho "✘ T-295 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-295"
  FALHAS="$FALHAS T-295"
  return 1
}

# ── sequencial T-296 (ordem do tasks.md) ──
executar_seq_T_296() {
  info 'sequencial T-296 — Stream checkout operation updates over existing SSE'
  if rodar_tarefa seq 'T-296' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-296 — "Stream checkout operation updates over existing SSE"
  critérios/refs: AC-344 (Emit operation updates over the existing SSE implementation), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java
  mensagem de commit: "T-296 refactor-checkout-operation-flow: Stream checkout operation updates over existing SSE"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-296 refactor-checkout-operation-flow: Stream checkout operation updates over existing SSE (auto-commit do plano)'
    fi
    marcar_concluidas T-296
    verde "✔ T-296 concluída"
    return 0
  fi
  vermelho "✘ T-296 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-296"
  FALHAS="$FALHAS T-296"
  return 1
}

# ── sequencial T-297 (ordem do tasks.md) ──
executar_seq_T_297() {
  info 'sequencial T-297 — Verify deterministic Payment provider idempotency'
  if rodar_tarefa seq 'T-297' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-297 — "Verify deterministic Payment provider idempotency"
  critérios/refs: AC-338 (Use one payment-provider idempotency key after crash), AC-339 (Create at most one internal Transaction for one checkout), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransaction.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransactionHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java
  mensagem de commit: "T-297 refactor-checkout-operation-flow: Verify deterministic Payment provider idempotency"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-297 refactor-checkout-operation-flow: Verify deterministic Payment provider idempotency (auto-commit do plano)'
    fi
    marcar_concluidas T-297
    verde "✔ T-297 concluída"
    return 0
  fi
  vermelho "✘ T-297 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-297"
  FALHAS="$FALHAS T-297"
  return 1
}

# ── sequencial T-298 (ordem do tasks.md) ──
executar_seq_T_298() {
  info 'sequencial T-298 — Commit Transaction projection and integration outbox atomically'
  if rodar_tarefa seq 'T-298' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-298 — "Commit Transaction projection and integration outbox atomically"
  critérios/refs: AC-345 (Commit local state and integration outbox atomically)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/event/TransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionViewStore.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionalTransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
  mensagem de commit: "T-298 refactor-checkout-operation-flow: Commit Transaction projection and integration outbox atomically"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-298 refactor-checkout-operation-flow: Commit Transaction projection and integration outbox atomically (auto-commit do plano)'
    fi
    marcar_concluidas T-298
    verde "✔ T-298 concluída"
    return 0
  fi
  vermelho "✘ T-298 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-298"
  FALHAS="$FALHAS T-298"
  return 1
}

# ── sequencial T-299 (ordem do tasks.md) ──
executar_seq_T_299() {
  info 'sequencial T-299 — Prove existing outbox relay and consumer delivery guarantees'
  if rodar_tarefa seq 'T-299' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-299 — "Prove existing outbox relay and consumer delivery guarantees"
  critérios/refs: AC-346 (Publish at least once from multiple instances), AC-347 (Make redelivered integration messages harmless), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/ReliableAmqpConsumer.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/OutboxRelay.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/persistence/JpaOutboxStore.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java
  mensagem de commit: "T-299 refactor-checkout-operation-flow: Prove existing outbox relay and consumer delivery guarantees"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-299 refactor-checkout-operation-flow: Prove existing outbox relay and consumer delivery guarantees (auto-commit do plano)'
    fi
    marcar_concluidas T-299
    verde "✔ T-299 concluída"
    return 0
  fi
  vermelho "✘ T-299 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-299"
  FALHAS="$FALHAS T-299"
  return 1
}

# ── sequencial T-300 (ordem do tasks.md) ──
executar_seq_T_300() {
  info 'sequencial T-300 — Remove obsolete checkout machinery and close all gates'
  if rodar_tarefa seq 'T-300' 'Você executa UMA tarefa da feature "refactor-checkout-operation-flow" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/refactor-checkout-operation-flow/spec.md, .spec/features/refactor-checkout-operation-flow/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-300 — "Remove obsolete checkout machinery and close all gates"
  critérios/refs: AC-333 (Derive one operation identity and preserve command hashing), AC-334 (Reject reuse with a different semantic payload), AC-335 (Resolve the PostgreSQL creation race), AC-336 (Sequence one operation without global serialization), AC-337 (Return operation state without synchronous checkout waiting), AC-338 (Use one payment-provider idempotency key after crash), AC-339 (Create at most one internal Transaction for one checkout), AC-340 (Commit WooCommerce creation-requested before create), AC-341 (Reconcile an unknown WooCommerce outcome without blind create), AC-342 (Keep one deterministic WooCommerce reference), AC-343 (Persist queryable operation outcomes), AC-344 (Emit operation updates over the existing SSE implementation), AC-345 (Commit local state and integration outbox atomically), AC-346 (Publish at least once from multiple instances), AC-347 (Make redelivered integration messages harmless), AC-348 (Remove checkout polling, leases, and ownership), AC-349 (Preserve meaningful operation states and retry behavior), AC-350 (Correlate safely across every boundary)
  arquivos permitidos (e seus testes): apps/payment-federation, test/migrate-order-workflow-to-axon-java.test.mjs, .spec/features/refactor-checkout-operation-flow
  mensagem de commit: "T-300 refactor-checkout-operation-flow: Remove obsolete checkout machinery and close all gates"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-300 refactor-checkout-operation-flow: Remove obsolete checkout machinery and close all gates (auto-commit do plano)'
    fi
    marcar_concluidas T-300
    verde "✔ T-300 concluída"
    return 0
  fi
  vermelho "✘ T-300 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --seq T-300"
  FALHAS="$FALHAS T-300"
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
      amarelo "  para o veredito: bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh --gate"
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
  executar_seq_T_290 || true
  executar_seq_T_293 || true
  executar_seq_T_294 || true
  executar_seq_T_295 || true
  executar_seq_T_296 || true
  executar_seq_T_297 || true
  executar_seq_T_298 || true
  executar_seq_T_299 || true
  executar_seq_T_300 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-290 (sequencial)"
  echo "  seq       T-293 (sequencial)"
  echo "  seq       T-294 (sequencial)"
  echo "  seq       T-295 (sequencial)"
  echo "  seq       T-296 (sequencial)"
  echo "  seq       T-297 (sequencial)"
  echo "  seq       T-298 (sequencial)"
  echo "  seq       T-299 (sequencial)"
  echo "  seq       T-300 (sequencial)"
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
      T-290) evento --tipo inicio --escopo "seq:T-290"; iniciar_resumos; executar_seq_T_290 || true; encerrar "seq:T-290" ;;
      T-293) evento --tipo inicio --escopo "seq:T-293"; iniciar_resumos; executar_seq_T_293 || true; encerrar "seq:T-293" ;;
      T-294) evento --tipo inicio --escopo "seq:T-294"; iniciar_resumos; executar_seq_T_294 || true; encerrar "seq:T-294" ;;
      T-295) evento --tipo inicio --escopo "seq:T-295"; iniciar_resumos; executar_seq_T_295 || true; encerrar "seq:T-295" ;;
      T-296) evento --tipo inicio --escopo "seq:T-296"; iniciar_resumos; executar_seq_T_296 || true; encerrar "seq:T-296" ;;
      T-297) evento --tipo inicio --escopo "seq:T-297"; iniciar_resumos; executar_seq_T_297 || true; encerrar "seq:T-297" ;;
      T-298) evento --tipo inicio --escopo "seq:T-298"; iniciar_resumos; executar_seq_T_298 || true; encerrar "seq:T-298" ;;
      T-299) evento --tipo inicio --escopo "seq:T-299"; iniciar_resumos; executar_seq_T_299 || true; encerrar "seq:T-299" ;;
      T-300) evento --tipo inicio --escopo "seq:T-300"; iniciar_resumos; executar_seq_T_300 || true; encerrar "seq:T-300" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
