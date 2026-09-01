#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano delivery-closure` em 2026-08-31 15:29
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo delivery-closure
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-delivery-closure-mthe9061'
FEATURE='delivery-closure'
BASE_BRANCH='spec/delivery-closure'
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
  git ls-files --error-unmatch -- '.spec/features/delivery-closure/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-delivery-closure-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-delivery-closure"
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
    amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-085 (ordem do tasks.md) ──
executar_seq_T_085() {
  info 'sequencial T-085 — Encode the immutable challenge compliance gate'
  if rodar_tarefa seq 'T-085' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-085 — "Encode the immutable challenge compliance gate"
  critérios/refs: AC-109 (Compliance evidence uses the challenge as source of truth)
  arquivos permitidos (e seus testes): docs/evidence/challenge-compliance.md, test/challenge-compliance-contract.test.mjs, test/five-app-topology.test.mjs, test/milestone-8-real-e2e.test.mjs
  mensagem de commit: "T-085 delivery-closure: Encode the immutable challenge compliance gate"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-085 delivery-closure: Encode the immutable challenge compliance gate (auto-commit do plano)'
    fi
    marcar_concluidas T-085
    verde "✔ T-085 concluída"
    return 0
  fi
  vermelho "✘ T-085 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-085"
  FALHAS="$FALHAS T-085"
  return 1
}

# ── sequencial T-086 (ordem do tasks.md) ──
executar_seq_T_086() {
  info 'sequencial T-086 — Restore durable checkout and RabbitMQ choreography'
  if rodar_tarefa seq 'T-086' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-086 — "Restore durable checkout and RabbitMQ choreography"
  critérios/refs: AC-110 (RabbitMQ choreography is active)
  arquivos permitidos (e seus testes): apps/commerce-subgraph, libs/contracts/graphql/commerce/schema.graphql, libs/contracts/events, compose.yaml, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, nx.json, test/delivery-closure-rabbitmq.test.mjs
  mensagem de commit: "T-086 delivery-closure: Restore durable checkout and RabbitMQ choreography"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-086 delivery-closure: Restore durable checkout and RabbitMQ choreography (auto-commit do plano)'
    fi
    marcar_concluidas T-086
    verde "✔ T-086 concluída"
    return 0
  fi
  vermelho "✘ T-086 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-086"
  FALHAS="$FALHAS T-086"
  return 1
}

# ── sequencial T-087 (ordem do tasks.md) ──
executar_seq_T_087() {
  info 'sequencial T-087 — Reactivate the Java Payment Federation event runtime'
  if rodar_tarefa seq 'T-087' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-087 — "Reactivate the Java Payment Federation event runtime"
  critérios/refs: AC-111 (Payment delivery is reliable and idempotent)
  arquivos permitidos (e seus testes): apps/payment-processor/build.gradle.kts, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging, apps/payment-processor/src/main/resources, apps/payment-processor/src/test, test/delivery-closure-payment-runtime.test.mjs
  mensagem de commit: "T-087 delivery-closure: Reactivate the Java Payment Federation event runtime"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-087 delivery-closure: Reactivate the Java Payment Federation event runtime (auto-commit do plano)'
    fi
    marcar_concluidas T-087
    verde "✔ T-087 concluída"
    return 0
  fi
  vermelho "✘ T-087 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-087"
  FALHAS="$FALHAS T-087"
  return 1
}

# ── sequencial T-088 (ordem do tasks.md) ──
executar_seq_T_088() {
  info 'sequencial T-088 — Add inventory reaction and compensation to Payment Federation'
  if rodar_tarefa seq 'T-088' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-088 — "Add inventory reaction and compensation to Payment Federation"
  critérios/refs: AC-112 (Payment Federation compensates inventory failure)
  arquivos permitidos (e seus testes): apps/payment-processor/src/main/java/dev/desafio/payment/inventory, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging, apps/payment-processor/src/test, apps/wordpress-integration, libs/contracts/events, compose.yaml, test/delivery-closure-inventory-saga.test.mjs
  mensagem de commit: "T-088 delivery-closure: Add inventory reaction and compensation to Payment Federation"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-088 delivery-closure: Add inventory reaction and compensation to Payment Federation (auto-commit do plano)'
    fi
    marcar_concluidas T-088
    verde "✔ T-088 concluída"
    return 0
  fi
  vermelho "✘ T-088 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-088"
  FALHAS="$FALHAS T-088"
  return 1
}

# ── sequencial T-089 (ordem do tasks.md) ──
executar_seq_T_089() {
  info 'sequencial T-089 — Repair the complete Testcontainers acceptance journey'
  if rodar_tarefa seq 'T-089' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-089 — "Repair the complete Testcontainers acceptance journey"
  critérios/refs: AC-113 (E2E starts every mandatory component), AC-114 (E2E proves the complete buyer contract)
  arquivos permitidos (e seus testes): apps/e2e/src/environment.ts, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, apps/e2e/project.json, libs/contracts/graphql/supergraph.yaml, test/milestone-7-e2e-contract.test.mjs, test/milestone-8-real-e2e.test.mjs
  mensagem de commit: "T-089 delivery-closure: Repair the complete Testcontainers acceptance journey"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-089 delivery-closure: Repair the complete Testcontainers acceptance journey (auto-commit do plano)'
    fi
    marcar_concluidas T-089
    verde "✔ T-089 concluída"
    return 0
  fi
  vermelho "✘ T-089 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-089"
  FALHAS="$FALHAS T-089"
  return 1
}

# ── sequencial T-090 (ordem do tasks.md) ──
executar_seq_T_090() {
  info 'sequencial T-090 — Add optional end-to-end observability'
  if rodar_tarefa seq 'T-090' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-090 — "Add optional end-to-end observability"
  critérios/refs: AC-115 (Telemetry crosses RabbitMQ and Payment Federation)
  arquivos permitidos (e seus testes): package.json, pnpm-lock.yaml, libs/platform/nest/src, apps/gateway/src/main.ts, apps/identity-subgraph/src/main.ts, apps/commerce-subgraph/src, apps/wordpress-federation/src/main.ts, apps/payment-processor, compose.yaml, infra/observability/otel-collector.yaml, docs/runbooks/observability.md, test/delivery-closure-observability.test.mjs
  mensagem de commit: "T-090 delivery-closure: Add optional end-to-end observability"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-090 delivery-closure: Add optional end-to-end observability (auto-commit do plano)'
    fi
    marcar_concluidas T-090
    verde "✔ T-090 concluída"
    return 0
  fi
  vermelho "✘ T-090 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-090"
  FALHAS="$FALHAS T-090"
  return 1
}

# ── sequencial T-091 (ordem do tasks.md) ──
executar_seq_T_091() {
  info 'sequencial T-091 — Reconcile documentation and close every gate'
  if rodar_tarefa seq 'T-091' 'Você executa UMA tarefa da feature "delivery-closure" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-091 — "Reconcile documentation and close every gate"
  critérios/refs: AC-116 (Final records and gates agree)
  arquivos permitidos (e seus testes): README.md, docs/evidence/challenge-compliance.md, docs/evidence/milestone-8/requirements.md, docs/prds/08-riscos-e-decisoes-pendentes.md, docs/adrs/004-restricoes-de-entrega.md, docs/adrs/007-federated-platform-boundaries.md, docs/runbooks, .spec/features/milestone-6-apollo-mcp/spec.md, .spec/features/milestone-7-e2e-deployment/spec.md, .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md, .spec/verification/delivery-closure.json, libs/wordpress/nest/src/federation/wordpress-federation.module.ts
  mensagem de commit: "T-091 delivery-closure: Reconcile documentation and close every gate"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-091 delivery-closure: Reconcile documentation and close every gate (auto-commit do plano)'
    fi
    marcar_concluidas T-091
    verde "✔ T-091 concluída"
    return 0
  fi
  vermelho "✘ T-091 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/delivery-closure/executar-tarefas.sh --seq T-091"
  FALHAS="$FALHAS T-091"
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
      amarelo "  para o veredito: bash .spec/features/delivery-closure/executar-tarefas.sh --gate"
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
  executar_seq_T_085 || true
  executar_seq_T_086 || true
  executar_seq_T_087 || true
  executar_seq_T_088 || true
  executar_seq_T_089 || true
  executar_seq_T_090 || true
  executar_seq_T_091 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-085 (sequencial)"
  echo "  seq       T-086 (sequencial)"
  echo "  seq       T-087 (sequencial)"
  echo "  seq       T-088 (sequencial)"
  echo "  seq       T-089 (sequencial)"
  echo "  seq       T-090 (sequencial)"
  echo "  seq       T-091 (sequencial)"
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
      T-085) evento --tipo inicio --escopo "seq:T-085"; iniciar_resumos; executar_seq_T_085 || true; encerrar "seq:T-085" ;;
      T-086) evento --tipo inicio --escopo "seq:T-086"; iniciar_resumos; executar_seq_T_086 || true; encerrar "seq:T-086" ;;
      T-087) evento --tipo inicio --escopo "seq:T-087"; iniciar_resumos; executar_seq_T_087 || true; encerrar "seq:T-087" ;;
      T-088) evento --tipo inicio --escopo "seq:T-088"; iniciar_resumos; executar_seq_T_088 || true; encerrar "seq:T-088" ;;
      T-089) evento --tipo inicio --escopo "seq:T-089"; iniciar_resumos; executar_seq_T_089 || true; encerrar "seq:T-089" ;;
      T-090) evento --tipo inicio --escopo "seq:T-090"; iniciar_resumos; executar_seq_T_090 || true; encerrar "seq:T-090" ;;
      T-091) evento --tipo inicio --escopo "seq:T-091"; iniciar_resumos; executar_seq_T_091 || true; encerrar "seq:T-091" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
