#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano modularize-order-workflow-subgraph` em 2026-09-05 17:16
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo modularize-order-workflow-subgraph
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-modularize-order-workflow-subgraph-mtonahif'
FEATURE='modularize-order-workflow-subgraph'
BASE_BRANCH='spec/modularize-order-workflow-subgraph'
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
  git ls-files --error-unmatch -- '.spec/features/modularize-order-workflow-subgraph/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-modularize-order-workflow-subgraph-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-modularize-order-workflow-subgraph"
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
    amarelo "  reexecute só ela: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-203 (ordem do tasks.md) ──
executar_seq_T_203() {
  info 'sequencial T-203 — Extract persistence and checkout modules'
  if rodar_tarefa seq 'T-203' 'Você executa UMA tarefa da feature "modularize-order-workflow-subgraph" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/modularize-order-workflow-subgraph/spec.md, .spec/features/modularize-order-workflow-subgraph/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-203 — "Extract persistence and checkout modules"
  critérios/refs: AC-246 (Persistência possui seu próprio módulo), AC-247 (Checkout possui seu próprio módulo), AC-251 (Comportamento público permanece inalterado)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/persistence/persistence.module.ts, apps/order-workflow-subgraph/src/persistence/persistence.tokens.ts, apps/order-workflow-subgraph/src/persistence/persistence.module.spec.ts, apps/order-workflow-subgraph/src/checkout/checkout.module.ts, apps/order-workflow-subgraph/src/checkout/checkout.tokens.ts, apps/order-workflow-subgraph/src/checkout/checkout.module.spec.ts, apps/order-workflow-subgraph/src/checkout/checkout.service.ts, apps/order-workflow-subgraph/src/checkout/checkout.repository.ts, apps/order-workflow-subgraph/src/outbox/outbox.repository.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.tokens.ts, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/src/health.controller.ts
  mensagem de commit: "T-203 modularize-order-workflow-subgraph: Extract persistence and checkout modules"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-203 modularize-order-workflow-subgraph: Extract persistence and checkout modules (auto-commit do plano)'
    fi
    marcar_concluidas T-203
    verde "✔ T-203 concluída"
    return 0
  fi
  vermelho "✘ T-203 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --seq T-203"
  FALHAS="$FALHAS T-203"
  return 1
}

# ── sequencial T-204 (ordem do tasks.md) ──
executar_seq_T_204() {
  info 'sequencial T-204 — Create the order-events module and align transport files'
  if rodar_tarefa seq 'T-204' 'Você executa UMA tarefa da feature "modularize-order-workflow-subgraph" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/modularize-order-workflow-subgraph/spec.md, .spec/features/modularize-order-workflow-subgraph/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-204 — "Create the order-events module and align transport files"
  critérios/refs: AC-248 (Eventos de pedido possuem uma fronteira coerente), AC-251 (Comportamento público permanece inalterado)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/order-events, apps/order-workflow-subgraph/src/graphql/sse, apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, apps/order-workflow-subgraph/src/health.controller.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.ts, apps/order-workflow-subgraph/src/app.module.spec.ts, apps/order-workflow-subgraph/src/order-workflow-subgraph.integration.spec.ts
  mensagem de commit: "T-204 modularize-order-workflow-subgraph: Create the order-events module and align transport files"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-204 modularize-order-workflow-subgraph: Create the order-events module and align transport files (auto-commit do plano)'
    fi
    marcar_concluidas T-204
    verde "✔ T-204 concluída"
    return 0
  fi
  vermelho "✘ T-204 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --seq T-204"
  FALHAS="$FALHAS T-204"
  return 1
}

# ── sequencial T-205 (ordem do tasks.md) ──
executar_seq_T_205() {
  info 'sequencial T-205 — Extract messaging composition and saga collaborators'
  if rodar_tarefa seq 'T-205' 'Você executa UMA tarefa da feature "modularize-order-workflow-subgraph" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/modularize-order-workflow-subgraph/spec.md, .spec/features/modularize-order-workflow-subgraph/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-205 — "Extract messaging composition and saga collaborators"
  critérios/refs: AC-249 (Mensageria e processamento da saga possuem responsabilidades separadas), AC-251 (Comportamento público permanece inalterado)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/messaging/messaging.module.ts, apps/order-workflow-subgraph/src/messaging/messaging.module.spec.ts, apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.ts, apps/order-workflow-subgraph/src/saga/order-saga.repository.ts, apps/order-workflow-subgraph/src/saga/postgres-order-event.notifier.ts, apps/order-workflow-subgraph/src/saga/order-event.consumer.spec.ts, apps/order-workflow-subgraph/src/inbox/inbox.repository.ts, apps/order-workflow-subgraph/src/outbox/outbox.publisher.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, apps/order-workflow-subgraph/src/health.controller.ts
  mensagem de commit: "T-205 modularize-order-workflow-subgraph: Extract messaging composition and saga collaborators"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-205 modularize-order-workflow-subgraph: Extract messaging composition and saga collaborators (auto-commit do plano)'
    fi
    marcar_concluidas T-205
    verde "✔ T-205 concluída"
    return 0
  fi
  vermelho "✘ T-205 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --seq T-205"
  FALHAS="$FALHAS T-205"
  return 1
}

# ── sequencial T-206 (ordem do tasks.md) ──
executar_seq_T_206() {
  info 'sequencial T-206 — Finalize the application composition root'
  if rodar_tarefa seq 'T-206' 'Você executa UMA tarefa da feature "modularize-order-workflow-subgraph" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/modularize-order-workflow-subgraph/spec.md, .spec/features/modularize-order-workflow-subgraph/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-206 — "Finalize the application composition root"
  critérios/refs: AC-246 (Persistência possui seu próprio módulo), AC-247 (Checkout possui seu próprio módulo), AC-248 (Eventos de pedido possuem uma fronteira coerente), AC-249 (Mensageria e processamento da saga possuem responsabilidades separadas), AC-250 (GraphQL é apenas a fronteira de transporte), AC-251 (Comportamento público permanece inalterado)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/app.module.ts, apps/order-workflow-subgraph/src/app.module.spec.ts, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/src/health.controller.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.spec.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.tokens.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts, apps/order-workflow-subgraph/src/checkout, apps/order-workflow-subgraph/src/persistence/entities, apps/order-workflow-subgraph/src/saga/order-workflow-state.ts, apps/order-workflow-subgraph/src/order-workflow-subgraph.integration.spec.ts, .spec/features/modularize-order-workflow-subgraph/evidence.md
  mensagem de commit: "T-206 modularize-order-workflow-subgraph: Finalize the application composition root"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `find test -maxdepth 1 -name '\''*.test.mjs'\'' -print0 | xargs -0 env NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx --test --test-reporter=tap && pnpm exec vitest run --reporter=tap` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-206 modularize-order-workflow-subgraph: Finalize the application composition root (auto-commit do plano)'
    fi
    marcar_concluidas T-206
    verde "✔ T-206 concluída"
    return 0
  fi
  vermelho "✘ T-206 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --seq T-206"
  FALHAS="$FALHAS T-206"
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
      amarelo "  para o veredito: bash .spec/features/modularize-order-workflow-subgraph/executar-tarefas.sh --gate"
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
  executar_seq_T_203 || true
  executar_seq_T_204 || true
  executar_seq_T_205 || true
  executar_seq_T_206 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-203 (sequencial)"
  echo "  seq       T-204 (sequencial)"
  echo "  seq       T-205 (sequencial)"
  echo "  seq       T-206 (sequencial)"
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
      T-203) evento --tipo inicio --escopo "seq:T-203"; iniciar_resumos; executar_seq_T_203 || true; encerrar "seq:T-203" ;;
      T-204) evento --tipo inicio --escopo "seq:T-204"; iniciar_resumos; executar_seq_T_204 || true; encerrar "seq:T-204" ;;
      T-205) evento --tipo inicio --escopo "seq:T-205"; iniciar_resumos; executar_seq_T_205 || true; encerrar "seq:T-205" ;;
      T-206) evento --tipo inicio --escopo "seq:T-206"; iniciar_resumos; executar_seq_T_206 || true; encerrar "seq:T-206" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
