#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano resolve-node-review-todos` em 2026-09-05 07:06
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo resolve-node-review-todos
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-resolve-node-review-todos-mto1hpmq'
FEATURE='resolve-node-review-todos'
BASE_BRANCH='spec/resolve-node-review-todos'
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
  git ls-files --error-unmatch -- '.spec/features/resolve-node-review-todos/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-resolve-node-review-todos"
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
    amarelo "  reexecute só ela: bash .spec/features/resolve-node-review-todos/executar-tarefas.sh --faixa $1"
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

# ── faixa-1: T-184 ──
executar_faixa_1() {
  local WT="$WT_BASE-faixa-1"
  preparar_worktree 'faixa-1' 'spec/resolve-node-review-todos-faixa-1' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-1' --estado executando --tentativa "$(tentativa 'faixa-1')"
  : > "$LOG_DIR/faixa-1.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-1' 'T-184' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-184 — "Resolve gateway authentication, federation and loader findings"
  critérios/refs: AC-226 (Resolve gateway authentication, federation and loader findings)
  arquivos permitidos (e seus testes): apps/gateway/src/app.module.ts, apps/gateway/src/health.controller.ts, apps/gateway/src/main.ts, libs/gateway/nest/src/auth/auth-context.factory.ts, libs/gateway/nest/src/auth/token-verifier.service.ts, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, docs/reviews/gateway-auth-refactor.md, libs/gateway/nest/src/index.ts, libs/platform/nest/src/index.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts, test/gateway-auth-review-ledger.test.mjs, .spec/features/gateway-auth-review-ledger/spec.md, .spec/features/gateway-auth-review-ledger/tasks.md, apps/gateway/src/subscriptions/order-workflow-subscription.client.ts, apps/gateway/src/subscriptions/sse-handler.ts, apps/gateway/src/subscriptions/sse.middleware.ts, docs/evidence/node-review/T-184.md, libs/gateway/nest/src/auth/auth-context.factory.spec.ts, libs/gateway/nest/src/auth/gateway-context.spec.ts, libs/gateway/nest/src/auth/gateway-context.ts, libs/gateway/nest/src/auth/gateway-request.adapter.spec.ts, libs/gateway/nest/src/auth/gateway-request.adapter.ts, libs/gateway/nest/src/auth/token-verifier.service.spec.ts, libs/gateway/nest/src/federation/authenticated-data-source.spec.ts, libs/gateway/nest/src/gateway-path.integration.spec.ts, libs/gateway/nest/src/gateway.module.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.spec.ts, test/fixtures/catalog-loaders.ts, test/gateway-federation-refactor.test.mjs, test/milestone-6-mcp-propagation.test.mjs, test/milestone-7-load.test.mjs, test/resolve-gateway-sse-todos.test.mjs, test/structural-gateway-review.test.mjs
  mensagem de commit: "T-184 resolve-node-review-todos: Resolve gateway authentication, federation and loader findings"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high
  ) >> "$LOG_DIR/faixa-1.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-1' 'spec/resolve-node-review-todos-faixa-1' "$WT" "$st" || return 1
  marcar_concluidas T-184
  return 0
}

# ── faixa-2: T-185 T-186 ──
executar_faixa_2() {
  local WT="$WT_BASE-faixa-2"
  preparar_worktree 'faixa-2' 'spec/resolve-node-review-todos-faixa-2' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-2' --estado executando --tentativa "$(tentativa 'faixa-2')"
  : > "$LOG_DIR/faixa-2.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-2' 'T-185' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-185 — "Resolve Better Auth lifecycle, registration and resource scopes"
  critérios/refs: AC-227 (Resolve Better Auth lifecycle, registration and resource scopes)
  arquivos permitidos (e seus testes): libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/better-auth.module.ts, libs/identity/nest/src/auth/registration.service.ts, libs/identity/nest/src/auth/resource-audiences.ts, libs/identity/nest/src/identity.module.ts, docs/evidence/node-review/T-185.md, libs/identity/nest/src/auth/better-auth.factory.spec.ts, libs/identity/nest/src/auth/better-auth.module.integration.spec.ts, libs/identity/nest/src/auth/identity-auth.error.ts, libs/identity/nest/src/auth/registration.service.spec.ts, test/identity-federation-refactor.test.mjs, test/oauth-resource-server-auth.spec.test.mjs
  mensagem de commit: "T-185 resolve-node-review-todos: Resolve Better Auth lifecycle, registration and resource scopes"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high &&
    rodar_tarefa 'faixa-2' 'T-186' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-186 — "Consolidate identity application, GraphQL and legacy consumers"
  critérios/refs: AC-228 (Consolidate identity application, GraphQL and legacy consumers)
  arquivos permitidos (e seus testes): apps/identity-subgraph/project.json, apps/identity-subgraph/src/app.module.ts, apps/identity-subgraph/src/health.controller.ts, apps/identity-subgraph/src/main.ts, libs/identity/nest/src/auth/better-auth.factory.spec.ts, libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts, libs/identity/nest/src/graphql/identity.resolver.spec.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/graphql/user.loader.ts, libs/identity/nest/src/graphql/user.repository.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/index.ts, test/fixtures/identity-supplier.ts, test/graphql-relay-dataloader-closure.test.mjs, test/identity-federation-refactor.test.mjs, test/milestone-6-mcp-oauth.test.mjs, test/milestone-8-identity-gateway.test.mjs, docs/evidence/node-review/T-186.md
  mensagem de commit: "T-186 resolve-node-review-todos: Consolidate identity application, GraphQL and legacy consumers"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium
  ) >> "$LOG_DIR/faixa-2.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-2' 'spec/resolve-node-review-todos-faixa-2' "$WT" "$st" || return 1
  marcar_concluidas T-185 T-186
  return 0
}

# ── faixa-3: T-187 T-188 T-189 ──
executar_faixa_3() {
  local WT="$WT_BASE-faixa-3"
  preparar_worktree 'faixa-3' 'spec/resolve-node-review-todos-faixa-3' "$WT" || return 1
  evento --tipo faixa --faixa 'faixa-3' --estado executando --tentativa "$(tentativa 'faixa-3')"
  : > "$LOG_DIR/faixa-3.log"
  (
    cd "$WT" || exit 9
    rodar_tarefa 'faixa-3' 'T-187' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-187 — "Resolve checkout, command hashing and persistence findings"
  critérios/refs: AC-229 (Resolve checkout, command hashing and persistence findings)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/checkout/checkout.repository.ts, apps/order-workflow-subgraph/src/checkout/checkout.service.ts, apps/order-workflow-subgraph/src/checkout/command-hash.ts, apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts, apps/order-workflow-subgraph/src/checkout/woo-checkout.port.ts, apps/order-workflow-subgraph/src/persistence/entities/checkout-operation.entity.ts, apps/order-workflow-subgraph/src/persistence/entities/inbox-record.entity.ts, apps/order-workflow-subgraph/src/persistence/entities/order-workflow.entity.ts, apps/order-workflow-subgraph/src/persistence/entities/outbox-event.entity.ts, apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts, apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts, apps/order-workflow-subgraph/src/checkout/checkout.service.spec.ts, apps/order-workflow-subgraph/src/checkout/command-hash.spec.ts, apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.spec.ts, docs/evidence/node-review/T-187.md, apps/order-workflow-subgraph/src/persistence/migrations/Migration202608270001.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202608270002.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202608280001.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202608280002.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010001.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010002.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010003.ts, apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010004.ts
  mensagem de commit: "T-187 resolve-node-review-todos: Resolve checkout, command hashing and persistence findings"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high &&
    rodar_tarefa 'faixa-3' 'T-188' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-188 — "Resolve inbox, outbox, messaging and saga findings"
  critérios/refs: AC-230 (Resolve inbox, outbox, messaging and saga findings)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts, apps/order-workflow-subgraph/src/checkout/checkout.repository.ts, apps/order-workflow-subgraph/src/inbox/inbox.repository.ts, apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.spec.ts, apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts, apps/order-workflow-subgraph/src/messaging/rabbitmq.integration.spec.ts, apps/order-workflow-subgraph/src/messaging/rabbitmq.spec.ts, apps/order-workflow-subgraph/src/messaging/rabbitmq.ts, apps/order-workflow-subgraph/src/outbox/outbox.publisher.spec.ts, apps/order-workflow-subgraph/src/outbox/outbox.publisher.ts, apps/order-workflow-subgraph/src/outbox/outbox.repository.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.integration.spec.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.ts, apps/order-workflow-subgraph/src/saga/order-saga.spec.ts, apps/order-workflow-subgraph/src/saga/order-saga.ts, docs/evidence/node-review/T-188.md
  mensagem de commit: "T-188 resolve-node-review-todos: Resolve inbox, outbox, messaging and saga findings"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high &&
    rodar_tarefa 'faixa-3' 'T-189' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-189 — "Resolve workflow GraphQL, bootstrap and SSE findings"
  critérios/refs: AC-231 (Resolve workflow GraphQL, bootstrap and SSE findings)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/graphql/authenticated-subject.decorator.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.tokens.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.types.ts, apps/order-workflow-subgraph/src/health.controller.ts, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/src/subscriptions/mikro-orm-order-event.replay.ts, apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.ts, apps/order-workflow-subgraph/src/subscriptions/sse-handler.ts, apps/order-workflow-subgraph/src/subscriptions/sse.middleware.ts, apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.spec.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.spec.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.spec.ts, apps/order-workflow-subgraph/src/health.controller.spec.ts, apps/order-workflow-subgraph/src/subscriptions/mikro-orm-order-event.replay.spec.ts, apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.spec.ts, apps/order-workflow-subgraph/src/subscriptions/sse-handler.spec.ts, apps/order-workflow-subgraph/src/subscriptions/sse.integration.spec.ts, apps/order-workflow-subgraph/src/subscriptions/sse.middleware.spec.ts, docs/evidence/node-review/T-189.md, apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts, apps/order-workflow-subgraph/src/subscriptions/order-event.channel.ts
  mensagem de commit: "T-189 resolve-node-review-todos: Resolve workflow GraphQL, bootstrap and SSE findings"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high
  ) >> "$LOG_DIR/faixa-3.log" 2>&1
  local st=$?
  mesclar_faixa 'faixa-3' 'spec/resolve-node-review-todos-faixa-3' "$WT" "$st" || return 1
  marcar_concluidas T-187 T-188 T-189
  return 0
}

# ── sequencial T-183 (fora da seleção do usuário) ──
executar_seq_T_183() {
  info 'sequencial T-183 — Prepare decorator runtime, test ownership and coverage'
  if rodar_tarefa seq 'T-183' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-183 — "Prepare decorator runtime, test ownership and coverage"
  critérios/refs: AC-225 (Prepare decorator runtime, test ownership and coverage)
  arquivos permitidos (e seus testes): apps/gateway/Dockerfile, apps/gateway/project.json, apps/identity-subgraph/Dockerfile, apps/identity-subgraph/project.json, apps/order-workflow-subgraph/Dockerfile, apps/order-workflow-subgraph/project.json, libs/gateway/nest/project.json, libs/identity/TODO.MD, libs/identity/nest/project.json, nx.json, onpspec.config.json, package.json, tsconfig.base.json, vitest.config.ts, apps/gateway/src/decorator-runtime.spec.ts, apps/identity-subgraph/src/decorator-runtime.spec.ts, apps/order-workflow-subgraph/src/decorator-runtime.spec.ts, docs/evidence/node-review/T-183.md, libs/gateway/nest/src/node-review-tooling.spec.ts, libs/identity/nest/src/decorator-runtime.spec.ts, libs/identity/nest/tsconfig.lib.json
  mensagem de commit: "T-183 resolve-node-review-todos: Prepare decorator runtime, test ownership and coverage"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-183 resolve-node-review-todos: Prepare decorator runtime, test ownership and coverage (auto-commit do plano)'
    fi
    marcar_concluidas T-183
    verde "✔ T-183 concluída"
    return 0
  fi
  vermelho "✘ T-183 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/resolve-node-review-todos/executar-tarefas.sh --seq T-183"
  FALHAS="$FALHAS T-183"
  return 1
}

# ── sequencial T-190 (fora da seleção do usuário) ──
executar_seq_T_190() {
  info 'sequencial T-190 — Integrate corrections and close every review finding with evidence'
  if rodar_tarefa seq 'T-190' 'Você executa UMA tarefa da feature "resolve-node-review-todos" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/resolve-node-review-todos/spec.md, .spec/features/resolve-node-review-todos/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-190 — "Integrate corrections and close every review finding with evidence"
  critérios/refs: AC-232 (Integrate corrections and close every review finding with evidence)
  arquivos permitidos (e seus testes): .spec/features/resolve-node-review-todos/inventory.json, .spec/features/resolve-node-review-todos/tasks.md, .spec/features/resolve-node-review-todos/spec.md, docs/evidence/node-review/T-190.md, docs/reviews/node-todo-resolution.md, test/resolve-node-review-inventory.test.mjs, vitest.config.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.spec.ts, graphify-out/graph.json, graphify-out/manifest.json, nx.json, libs/platform/nest/project.json, libs/gateway/nest/project.json, libs/identity/nest/project.json, apps/gateway/project.json, apps/identity-subgraph/project.json, apps/order-workflow-subgraph/project.json, test/typescript-editor-stability.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/production-happy-path-hardening.test.mjs, apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts, apps/order-workflow-subgraph/src/checkout/checkout.service.spec.ts, apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.spec.ts, apps/order-workflow-subgraph/src/messaging/rabbitmq.spec.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.integration.spec.ts, apps/order-workflow-subgraph/src/subscriptions/sse.integration.spec.ts, libs/gateway/nest/src/auth/auth-context.factory.spec.ts, libs/gateway/nest/src/node-review-tooling.spec.ts, libs/gateway/nest/tsconfig.json, libs/identity/nest/src/auth/better-auth.factory.spec.ts, libs/identity/nest/src/auth/registration.service.spec.ts, libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts, libs/identity/nest/tsconfig.json, libs/platform/nest/tsconfig.json, apps/gateway/tsconfig.spec.json, apps/gateway/tsconfig.json, apps/identity-subgraph/tsconfig.spec.json, apps/identity-subgraph/tsconfig.json, apps/order-workflow-subgraph/tsconfig.spec.json, apps/order-workflow-subgraph/tsconfig.json, libs/identity/nest/tsconfig.spec.json, libs/gateway/nest/tsconfig.spec.json, apps/e2e/src/milestone-7.e2e.test.ts
  mensagem de commit: "T-190 resolve-node-review-todos: Integrate corrections and close every review finding with evidence"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-190 resolve-node-review-todos: Integrate corrections and close every review finding with evidence (auto-commit do plano)'
    fi
    marcar_concluidas T-190
    verde "✔ T-190 concluída"
    return 0
  fi
  vermelho "✘ T-190 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/resolve-node-review-todos/executar-tarefas.sh --seq T-190"
  FALHAS="$FALHAS T-190"
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
      amarelo "  para o veredito: bash .spec/features/resolve-node-review-todos/executar-tarefas.sh --gate"
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
  # onda 1: faixa-1 ∥ faixa-2 ∥ faixa-3
  info "onda 1: faixa-1 ∥ faixa-2 ∥ faixa-3 — janelas limpas em paralelo"
  executar_faixa_1 & PID_FAIXA_1=$!
  executar_faixa_2 & PID_FAIXA_2=$!
  executar_faixa_3 & PID_FAIXA_3=$!
  wait "$PID_FAIXA_1" || true
  wait "$PID_FAIXA_2" || true
  wait "$PID_FAIXA_3" || true
  executar_seq_T_183 || true
  executar_seq_T_190 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  faixa-1  onda 1  T-184"
  echo "  faixa-2  onda 1  T-185, T-186"
  echo "  faixa-3  onda 1  T-187, T-188, T-189"
  echo "  seq       T-183 (sequencial)"
  echo "  seq       T-190 (sequencial)"
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
      faixa-3) evento --tipo inicio --escopo "faixa:faixa-3"; iniciar_resumos; executar_faixa_3 || true; encerrar "faixa:faixa-3" ;;
      *) falhar "faixa desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
  seq)
    case "$ALVO" in
      T-183) evento --tipo inicio --escopo "seq:T-183"; iniciar_resumos; executar_seq_T_183 || true; encerrar "seq:T-183" ;;
      T-190) evento --tipo inicio --escopo "seq:T-190"; iniciar_resumos; executar_seq_T_190 || true; encerrar "seq:T-190" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
