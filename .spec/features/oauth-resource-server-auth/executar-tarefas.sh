#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano oauth-resource-server-auth` em 2026-09-02 17:09
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo oauth-resource-server-auth
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-oauth-resource-server-auth-mtkcpdbr'
FEATURE='oauth-resource-server-auth'
BASE_BRANCH='spec/oauth-resource-server-auth'
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
  git ls-files --error-unmatch -- '.spec/features/oauth-resource-server-auth/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-oauth-resource-server-auth-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-oauth-resource-server-auth"
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
    amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-133 (ordem do tasks.md) ──
executar_seq_T_133() {
  info 'sequencial T-133 — Model owned OAuth resources in Better Auth'
  if rodar_tarefa seq 'T-133' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-133 — "Model owned OAuth resources in Better Auth"
  critérios/refs: AC-174 (Tokens are issued for every owned protected resource)
  arquivos permitidos (e seus testes): libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/plugins/oauth-provider-plugin.factory.ts, libs/identity/nest/src/auth/resource-audiences.ts, apps/identity-subgraph/src/auth/config.ts, test/oauth-resource-server-auth.spec.test.js
  mensagem de commit: "T-133 oauth-resource-server-auth: Model owned OAuth resources in Better Auth"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-133 oauth-resource-server-auth: Model owned OAuth resources in Better Auth (auto-commit do plano)'
    fi
    marcar_concluidas T-133
    verde "✔ T-133 concluída"
    return 0
  fi
  vermelho "✘ T-133 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-133"
  FALHAS="$FALHAS T-133"
  return 1
}

# ── sequencial T-134 (ordem do tasks.md) ──
executar_seq_T_134() {
  info 'sequencial T-134 — Build the shared NestJS OAuth resource module'
  if rodar_tarefa seq 'T-134' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-134 — "Build the shared NestJS OAuth resource module"
  critérios/refs: AC-176 (NestJS resource servers use Better Auth verification)
  arquivos permitidos (e seus testes): libs/platform/nest/src/auth, libs/platform/nest/src/index.ts, libs/identity/nest/src/identity.module.ts, apps/identity-subgraph/src/graphql/identity.module.ts, test/oauth-resource-server-auth.spec.test.js
  mensagem de commit: "T-134 oauth-resource-server-auth: Build the shared NestJS OAuth resource module"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-134 oauth-resource-server-auth: Build the shared NestJS OAuth resource module (auto-commit do plano)'
    fi
    marcar_concluidas T-134
    verde "✔ T-134 concluída"
    return 0
  fi
  vermelho "✘ T-134 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-134"
  FALHAS="$FALHAS T-134"
  return 1
}

# ── sequencial T-135 (ordem do tasks.md) ──
executar_seq_T_135() {
  info 'sequencial T-135 — Migrate Order Workflow GraphQL and SSE authentication'
  if rodar_tarefa seq 'T-135' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-135 — "Migrate Order Workflow GraphQL and SSE authentication"
  critérios/refs: AC-176 (NestJS resource servers use Better Auth verification), AC-178 (SSE validates the same bearer token)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/graphql, apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/project.json, test/oauth-resource-server-auth.spec.test.js, test/production-happy-path-hardening.spec.test.js
  mensagem de commit: "T-135 oauth-resource-server-auth: Migrate Order Workflow GraphQL and SSE authentication"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-135 oauth-resource-server-auth: Migrate Order Workflow GraphQL and SSE authentication (auto-commit do plano)'
    fi
    marcar_concluidas T-135
    verde "✔ T-135 concluída"
    return 0
  fi
  vermelho "✘ T-135 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-135"
  FALHAS="$FALHAS T-135"
  return 1
}

# ── sequencial T-136 (ordem do tasks.md) ──
executar_seq_T_136() {
  info 'sequencial T-136 — Forward bearer credentials through the Gateway'
  if rodar_tarefa seq 'T-136' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-136 — "Forward bearer credentials through the Gateway"
  critérios/refs: AC-175 (Federation preserves the standard bearer credential), AC-178 (SSE validates the same bearer token)
  arquivos permitidos (e seus testes): libs/gateway/nest/src/auth, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, apps/gateway/src/subscriptions, test/gateway-federation-refactor.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.js
  mensagem de commit: "T-136 oauth-resource-server-auth: Forward bearer credentials through the Gateway"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-136 oauth-resource-server-auth: Forward bearer credentials through the Gateway (auto-commit do plano)'
    fi
    marcar_concluidas T-136
    verde "✔ T-136 concluída"
    return 0
  fi
  vermelho "✘ T-136 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-136"
  FALHAS="$FALHAS T-136"
  return 1
}

# ── sequencial T-137 (ordem do tasks.md) ──
executar_seq_T_137() {
  info 'sequencial T-137 — Migrate Payment to Spring Security resource-server support'
  if rodar_tarefa seq 'T-137' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-137 — "Migrate Payment to Spring Security resource-server support"
  critérios/refs: AC-177 (Payment is a standard Spring OAuth resource server)
  arquivos permitidos (e seus testes): apps/payment-federation/build.gradle.kts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql, apps/payment-federation/src/main/resources/application.yaml, apps/payment-federation/src/test, test/structural-payment-review.test.mjs, test/oauth-resource-server-auth.spec.test.js
  mensagem de commit: "T-137 oauth-resource-server-auth: Migrate Payment to Spring Security resource-server support"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-137 oauth-resource-server-auth: Migrate Payment to Spring Security resource-server support (auto-commit do plano)'
    fi
    marcar_concluidas T-137
    verde "✔ T-137 concluída"
    return 0
  fi
  vermelho "✘ T-137 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-137"
  FALHAS="$FALHAS T-137"
  return 1
}

# ── sequencial T-138 (ordem do tasks.md) ──
executar_seq_T_138() {
  info 'sequencial T-138 — Remove the custom trust protocol and codify native-first review'
  if rodar_tarefa seq 'T-138' 'Você executa UMA tarefa da feature "oauth-resource-server-auth" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/oauth-resource-server-auth/spec.md, .spec/features/oauth-resource-server-auth/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-138 — "Remove the custom trust protocol and codify native-first review"
  critérios/refs: AC-174 (Tokens are issued for every owned protected resource), AC-175 (Federation preserves the standard bearer credential), AC-176 (NestJS resource servers use Better Auth verification), AC-177 (Payment is a standard Spring OAuth resource server), AC-178 (SSE validates the same bearer token), AC-179 (Native-first boundaries are documented and executable)
  arquivos permitidos (e seus testes): compose.yaml, docs/adrs, docs/prds, test, graphify-out, .spec/features/oauth-resource-server-auth, .spec/verification/oauth-resource-server-auth.json
  mensagem de commit: "T-138 oauth-resource-server-auth: Remove the custom trust protocol and codify native-first review"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json node --import tsx --test --test-reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-138 oauth-resource-server-auth: Remove the custom trust protocol and codify native-first review (auto-commit do plano)'
    fi
    marcar_concluidas T-138
    verde "✔ T-138 concluída"
    return 0
  fi
  vermelho "✘ T-138 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --seq T-138"
  FALHAS="$FALHAS T-138"
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
      amarelo "  para o veredito: bash .spec/features/oauth-resource-server-auth/executar-tarefas.sh --gate"
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
  executar_seq_T_133 || true
  executar_seq_T_134 || true
  executar_seq_T_135 || true
  executar_seq_T_136 || true
  executar_seq_T_137 || true
  executar_seq_T_138 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-133 (sequencial)"
  echo "  seq       T-134 (sequencial)"
  echo "  seq       T-135 (sequencial)"
  echo "  seq       T-136 (sequencial)"
  echo "  seq       T-137 (sequencial)"
  echo "  seq       T-138 (sequencial)"
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
      T-133) evento --tipo inicio --escopo "seq:T-133"; iniciar_resumos; executar_seq_T_133 || true; encerrar "seq:T-133" ;;
      T-134) evento --tipo inicio --escopo "seq:T-134"; iniciar_resumos; executar_seq_T_134 || true; encerrar "seq:T-134" ;;
      T-135) evento --tipo inicio --escopo "seq:T-135"; iniciar_resumos; executar_seq_T_135 || true; encerrar "seq:T-135" ;;
      T-136) evento --tipo inicio --escopo "seq:T-136"; iniciar_resumos; executar_seq_T_136 || true; encerrar "seq:T-136" ;;
      T-137) evento --tipo inicio --escopo "seq:T-137"; iniciar_resumos; executar_seq_T_137 || true; encerrar "seq:T-137" ;;
      T-138) evento --tipo inicio --escopo "seq:T-138"; iniciar_resumos; executar_seq_T_138 || true; encerrar "seq:T-138" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
