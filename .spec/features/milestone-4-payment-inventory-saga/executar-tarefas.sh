#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano milestone-4-payment-inventory-saga` em 2026-08-27 15:53
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo milestone-4-payment-inventory-saga
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-milestone-4-payment-inventory-saga-mtbpdc29'
FEATURE='milestone-4-payment-inventory-saga'
BASE_BRANCH='spec/milestone-4-payment-inventory-saga'
ENGINE='.agents/skills/onp-spec-driven/scripts/onp-spec.mjs'
CODEX_FLAGS=(--sandbox 'workspace-write')
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
  git ls-files --error-unmatch -- '.spec/features/milestone-4-payment-inventory-saga/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-milestone-4-payment-inventory-saga-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-milestone-4-payment-inventory-saga"
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
    amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --faixa $1"
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

# ── faixa-1: T-030 ──
executar_faixa_1() {
  local WT="$WT_BASE-faixa-1"
  preparar_worktree 'faixa-1' 'spec/milestone-4-payment-inventory-saga-faixa-1' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-1' --estado executando --tentativa "$(tentativa 'faixa-1')"
  : > "$LOG_DIR/faixa-1.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-1' 'T-030' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-030 — "Scaffold the Spring Boot payment processor and Nx Gradle targets"
  critérios/refs: AC-045 (Payment processor is operable through Nx)
  arquivos permitidos (e seus testes): package.json, pnpm-lock.yaml, nx.json, apps/payment-processor/settings.gradle.kts, apps/payment-processor/build.gradle.kts, apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java, apps/payment-processor/src/main/resources/application.yaml, apps/payment-processor/src/test/java/dev/desafio/payment/PaymentProcessorApplicationTest.java, test/milestone-4-nx-gradle.test.mjs
  mensagem de commit: "T-030 milestone-4-payment-inventory-saga: Scaffold the Spring Boot payment processor and Nx Gradle targets"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium
  ) >> "$LOG_DIR/faixa-1.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-1' 'spec/milestone-4-payment-inventory-saga-faixa-1' "$WT" "$st" || return 1
  marcar_concluidas T-030
  return 0
}

# ── faixa-2: T-032 ──
executar_faixa_2() {
  local WT="$WT_BASE-faixa-2"
  preparar_worktree 'faixa-2' 'spec/milestone-4-payment-inventory-saga-faixa-2' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-2' --estado executando --tentativa "$(tentativa 'faixa-2')"
  : > "$LOG_DIR/faixa-2.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-2' 'T-032' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-032 — "Implement the idempotent WooCommerce inventory worker"
  critérios/refs: AC-046 (Stock reservation changes WooCommerce once), AC-047 (Insufficient stock requests compensation), AC-051 (Crash after effect before acknowledgement is harmless)
  arquivos permitidos (e seus testes): apps/stock-worker/project.json, apps/stock-worker/src/inventory/inventory.service.ts, apps/stock-worker/src/inventory/woo-inventory.adapter.ts, apps/stock-worker/src/inventory/inbox.repository.ts, apps/stock-worker/src/main.ts, test/milestone-4-inventory-worker.test.mjs, test/milestone-4-inventory-redelivery.test.mjs
  mensagem de commit: "T-032 milestone-4-payment-inventory-saga: Implement the idempotent WooCommerce inventory worker"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium
  ) >> "$LOG_DIR/faixa-2.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-2' 'spec/milestone-4-payment-inventory-saga-faixa-2' "$WT" "$st" || return 1
  marcar_concluidas T-032
  return 0
}

# ── sequencial T-029 (fora da seleção do usuário) ──
executar_seq_T_029() {
  info 'sequencial T-029 — Add RabbitMQ topology and confirmed Commerce outbox publishing'
  if rodar_tarefa seq 'T-029' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-029 — "Add RabbitMQ topology and confirmed Commerce outbox publishing"
  critérios/refs: AC-041 (Outbox publication waits for broker confirmation), AC-042 (Consumer failures have bounded retry and DLQ), AC-051 (Crash after effect before acknowledgement is harmless)
  arquivos permitidos (e seus testes): package.json, pnpm-lock.yaml, apps/commerce-subgraph/src/messaging/rabbitmq.ts, apps/commerce-subgraph/src/outbox/outbox.publisher.ts, apps/commerce-subgraph/src/outbox/outbox.repository.ts, apps/commerce-subgraph/src/persistence/entities/outbox-event.entity.ts, apps/commerce-subgraph/src/persistence/migrations/Migration202608270002.ts, test/milestone-4-outbox-publisher.test.mjs, test/milestone-4-rabbitmq-topology.test.mjs
  mensagem de commit: "T-029 milestone-4-payment-inventory-saga: Add RabbitMQ topology and confirmed Commerce outbox publishing"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-029 milestone-4-payment-inventory-saga: Add RabbitMQ topology and confirmed Commerce outbox publishing (auto-commit do plano)'
    fi
    marcar_concluidas T-029
    verde "✔ T-029 concluída"
    return 0
  fi
  vermelho "✘ T-029 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --seq T-029"
  FALHAS="$FALHAS T-029"
  return 1
}

# ── sequencial T-031 (fora da seleção do usuário) ──
executar_seq_T_031() {
  info 'sequencial T-031 — Implement idempotent Card, Pix, and refund processing'
  if rodar_tarefa seq 'T-031' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-031 — "Implement idempotent Card, Pix, and refund processing"
  critérios/refs: AC-043 (Card authorization is applied once), AC-044 (Pix code generation is stable and terminal for this milestone), AC-049 (Stock failure refunds and cancels), AC-051 (Crash after effect before acknowledgement is harmless)
  arquivos permitidos (e seus testes): apps/payment-processor/src/main/java/dev/desafio/payment/domain/Payment.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/PaymentHandler.java, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentConsumer.java, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/persistence/PaymentRepository.java, apps/payment-processor/src/main/resources/db/migration/V1__payment_inbox_outbox.sql, apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java, apps/payment-processor/src/test/java/dev/desafio/payment/adapter/messaging/PaymentRedeliveryTest.java
  mensagem de commit: "T-031 milestone-4-payment-inventory-saga: Implement idempotent Card, Pix, and refund processing"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-031 milestone-4-payment-inventory-saga: Implement idempotent Card, Pix, and refund processing (auto-commit do plano)'
    fi
    marcar_concluidas T-031
    verde "✔ T-031 concluída"
    return 0
  fi
  vermelho "✘ T-031 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --seq T-031"
  FALHAS="$FALHAS T-031"
  return 1
}

# ── sequencial T-033 (fora da seleção do usuário) ──
executar_seq_T_033() {
  info 'sequencial T-033 — Implement monotonic Commerce saga transitions'
  if rodar_tarefa seq 'T-033' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-033 — "Implement monotonic Commerce saga transitions"
  critérios/refs: AC-048 (Successful Card journey completes), AC-049 (Stock failure refunds and cancels), AC-050 (Pix journey exposes the generated code), AC-051 (Crash after effect before acknowledgement is harmless)
  arquivos permitidos (e seus testes): apps/commerce-subgraph/src/saga/order-saga.ts, apps/commerce-subgraph/src/saga/order-event.consumer.ts, apps/commerce-subgraph/src/inbox/inbox.repository.ts, apps/commerce-subgraph/src/persistence/entities/order-workflow.entity.ts, apps/commerce-subgraph/src/persistence/entities/inbox-record.entity.ts, apps/commerce-subgraph/src/persistence/migrations/Migration202608270002.ts, libs/contracts/graphql/commerce/schema.graphql, test/milestone-4-order-saga.test.mjs, test/milestone-4-order-saga-redelivery.test.mjs
  mensagem de commit: "T-033 milestone-4-payment-inventory-saga: Implement monotonic Commerce saga transitions"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-033 milestone-4-payment-inventory-saga: Implement monotonic Commerce saga transitions (auto-commit do plano)'
    fi
    marcar_concluidas T-033
    verde "✔ T-033 concluída"
    return 0
  fi
  vermelho "✘ T-033 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --seq T-033"
  FALHAS="$FALHAS T-033"
  return 1
}

# ── sequencial T-034 (fora da seleção do usuário) ──
executar_seq_T_034() {
  info 'sequencial T-034 — Wire services, databases, and graceful lifecycle in Compose'
  if rodar_tarefa seq 'T-034' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-034 — "Wire services, databases, and graceful lifecycle in Compose"
  critérios/refs: AC-042 (Consumer failures have bounded retry and DLQ), AC-045 (Payment processor is operable through Nx)
  arquivos permitidos (e seus testes): compose.yaml, apps/commerce-subgraph/src/app.module.ts, apps/payment-processor/Dockerfile, apps/stock-worker/Dockerfile, apps/stock-worker/src/app.module.ts, test/milestone-4-compose.test.mjs
  mensagem de commit: "T-034 milestone-4-payment-inventory-saga: Wire services, databases, and graceful lifecycle in Compose"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-034 milestone-4-payment-inventory-saga: Wire services, databases, and graceful lifecycle in Compose (auto-commit do plano)'
    fi
    marcar_concluidas T-034
    verde "✔ T-034 concluída"
    return 0
  fi
  vermelho "✘ T-034 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --seq T-034"
  FALHAS="$FALHAS T-034"
  return 1
}

# ── sequencial T-035 (fora da seleção do usuário) ──
executar_seq_T_035() {
  info 'sequencial T-035 — Assemble the Milestone 4 acceptance and operational gate'
  if rodar_tarefa seq 'T-035' 'Você executa UMA tarefa da feature "milestone-4-payment-inventory-saga" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/milestone-4-payment-inventory-saga/spec.md, .spec/features/milestone-4-payment-inventory-saga/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-035 — "Assemble the Milestone 4 acceptance and operational gate"
  critérios/refs: AC-041 (Outbox publication waits for broker confirmation), AC-042 (Consumer failures have bounded retry and DLQ), AC-043 (Card authorization is applied once), AC-044 (Pix code generation is stable and terminal for this milestone), AC-045 (Payment processor is operable through Nx), AC-046 (Stock reservation changes WooCommerce once), AC-047 (Insufficient stock requests compensation), AC-048 (Successful Card journey completes), AC-049 (Stock failure refunds and cancels), AC-050 (Pix journey exposes the generated code), AC-051 (Crash after effect before acknowledgement is harmless), AC-052 (Milestone acceptance runs from one workspace command)
  arquivos permitidos (e seus testes): apps/poc-harness/project.json, test/milestone-4-payment-inventory-saga.test.mjs, docs/runbooks/milestone-4-payment-inventory-saga.md, onpspec.config.json, .github/workflows/ci.yml
  mensagem de commit: "T-035 milestone-4-payment-inventory-saga: Assemble the Milestone 4 acceptance and operational gate"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-2-oauth-bootstrap.test.mjs test/milestone-2-token-me.test.mjs test/milestone-2-registration.test.mjs test/milestone-2-supplier-ownership.test.mjs test/milestone-2-catalog-connection.test.mjs test/milestone-2-catalog-batching.test.mjs test/milestone-2-identity-catalog.test.mjs && node --experimental-transform-types --test --test-reporter=tap test/milestone-3-commerce-contract.test.mjs test/milestone-3-cart.test.mjs test/milestone-3-migrations.test.mjs test/milestone-3-checkout-idempotency.test.mjs test/milestone-3-checkout-recovery.test.mjs test/milestone-3-wordpress-checkout.test.mjs test/milestone-3-federated-me.test.mjs test/milestone-3-cart-order.test.mjs` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-035 milestone-4-payment-inventory-saga: Assemble the Milestone 4 acceptance and operational gate (auto-commit do plano)'
    fi
    marcar_concluidas T-035
    verde "✔ T-035 concluída"
    return 0
  fi
  vermelho "✘ T-035 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --seq T-035"
  FALHAS="$FALHAS T-035"
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
      amarelo "  para o veredito: bash .spec/features/milestone-4-payment-inventory-saga/executar-tarefas.sh --gate"
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
  # onda 1: faixa-1 ∥ faixa-2
  info "onda 1: faixa-1 ∥ faixa-2 — janelas limpas em paralelo"
  executar_faixa_1 & PID_FAIXA_1=$!
  executar_faixa_2 & PID_FAIXA_2=$!
  wait "$PID_FAIXA_1" || true
  wait "$PID_FAIXA_2" || true
  executar_seq_T_029 || true
  executar_seq_T_031 || true
  executar_seq_T_033 || true
  executar_seq_T_034 || true
  executar_seq_T_035 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  faixa-1  onda 1  T-030"
  echo "  faixa-2  onda 1  T-032"
  echo "  seq       T-029 (sequencial)"
  echo "  seq       T-031 (sequencial)"
  echo "  seq       T-033 (sequencial)"
  echo "  seq       T-034 (sequencial)"
  echo "  seq       T-035 (sequencial)"
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
      faixa-1) evento --tipo inicio --escopo "faixa:faixa-1"; iniciar_resumos; executar_faixa_1 || true; encerrar "faixa:faixa-1" ;;
      faixa-2) evento --tipo inicio --escopo "faixa:faixa-2"; iniciar_resumos; executar_faixa_2 || true; encerrar "faixa:faixa-2" ;;
      *) falhar "faixa desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
  seq)
    case "$ALVO" in
      T-029) evento --tipo inicio --escopo "seq:T-029"; iniciar_resumos; executar_seq_T_029 || true; encerrar "seq:T-029" ;;
      T-031) evento --tipo inicio --escopo "seq:T-031"; iniciar_resumos; executar_seq_T_031 || true; encerrar "seq:T-031" ;;
      T-033) evento --tipo inicio --escopo "seq:T-033"; iniciar_resumos; executar_seq_T_033 || true; encerrar "seq:T-033" ;;
      T-034) evento --tipo inicio --escopo "seq:T-034"; iniciar_resumos; executar_seq_T_034 || true; encerrar "seq:T-034" ;;
      T-035) evento --tipo inicio --escopo "seq:T-035"; iniciar_resumos; executar_seq_T_035 || true; encerrar "seq:T-035" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
