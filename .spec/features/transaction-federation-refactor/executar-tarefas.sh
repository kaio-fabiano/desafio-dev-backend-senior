#!/usr/bin/env bash
# executar-tarefas.sh — gerado por `onp-spec plano transaction-federation-refactor` em 2026-09-01 22:16
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
# resumo do que está rolando, a qualquer momento: onp-spec resumo transaction-federation-refactor
set -u
set -o pipefail

RUN_ID='desafio-dev-backend-senior-transaction-federation-refactor-mtj88w54'
FEATURE='transaction-federation-refactor'
BASE_BRANCH='spec/transaction-federation-refactor'
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
  git ls-files --error-unmatch -- '.spec/features/transaction-federation-refactor/spec.md' >/dev/null 2>&1 || falhar "spec.md não está commitada — os worktrees das faixas precisam dela no git"
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
  LOG_DIR="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-transaction-federation-refactor-logs"
  WT_BASE="$(dirname "$TOPLEVEL")/onp-worktrees/desafio-dev-backend-senior-transaction-federation-refactor"
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
    amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --faixa $1"
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

# ── sequencial T-108 (ordem do tasks.md) ──
executar_seq_T_108() {
  info 'sequencial T-108 — Provar capacidades nativas e fronteiras'
  if rodar_tarefa seq 'T-108' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-108 — "Provar capacidades nativas e fronteiras"
  critérios/refs: AC-139 (Operações comerciais pertencem ao WordPress), AC-140 (Workflow delega o checkout), AC-141 (Order Workflow é um serviço independente), AC-142 (Workflow não possui modelos comerciais)
  arquivos permitidos (e seus testes): test/order-workflow-boundaries.test.mjs, test/wordpress-native-commerce.test.mjs, libs/contracts/graphql/wordpress/schema.graphql
  mensagem de commit: "T-108 transaction-federation-refactor: Provar capacidades nativas e fronteiras"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-108 transaction-federation-refactor: Provar capacidades nativas e fronteiras (auto-commit do plano)'
    fi
    marcar_concluidas T-108
    verde "✔ T-108 concluída"
    return 0
  fi
  vermelho "✘ T-108 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-108"
  FALHAS="$FALHAS T-108"
  return 1
}

# ── sequencial T-109 (ordem do tasks.md) ──
executar_seq_T_109() {
  info 'sequencial T-109 — Renomear Commerce para Order Workflow'
  if rodar_tarefa seq 'T-109' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-109 — "Renomear Commerce para Order Workflow"
  critérios/refs: AC-141 (Order Workflow é um serviço independente), AC-142 (Workflow não possui modelos comerciais)
  arquivos permitidos (e seus testes): apps/commerce-subgraph, apps/order-workflow-subgraph, libs/contracts/graphql/commerce, libs/contracts/graphql/order-workflow, package.json, pnpm-lock.yaml, nx.json, tsconfig.json, tsconfig.base.json
  mensagem de commit: "T-109 transaction-federation-refactor: Renomear Commerce para Order Workflow"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-terra' medium >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-109 transaction-federation-refactor: Renomear Commerce para Order Workflow (auto-commit do plano)'
    fi
    marcar_concluidas T-109
    verde "✔ T-109 concluída"
    return 0
  fi
  vermelho "✘ T-109 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-109"
  FALHAS="$FALHAS T-109"
  return 1
}

# ── sequencial T-110 (ordem do tasks.md) ──
executar_seq_T_110() {
  info 'sequencial T-110 — Remover wrappers e delegar ao WooGraphQL'
  if rodar_tarefa seq 'T-110' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-110 — "Remover wrappers e delegar ao WooGraphQL"
  critérios/refs: AC-139 (Operações comerciais pertencem ao WordPress), AC-140 (Workflow delega o checkout), AC-143 (Idempotência concorrente ponta a ponta), AC-144 (Reutilização conflitante é recusada)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/cart, apps/order-workflow-subgraph/src/checkout, apps/order-workflow-subgraph/src/graphql, libs/contracts/graphql/order-workflow/schema.graphql, apps/order-workflow-subgraph/src/checkout
  mensagem de commit: "T-110 transaction-federation-refactor: Remover wrappers e delegar ao WooGraphQL"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-110 transaction-federation-refactor: Remover wrappers e delegar ao WooGraphQL (auto-commit do plano)'
    fi
    marcar_concluidas T-110
    verde "✔ T-110 concluída"
    return 0
  fi
  vermelho "✘ T-110 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-110"
  FALHAS="$FALHAS T-110"
  return 1
}

# ── sequencial T-111 (ordem do tasks.md) ──
executar_seq_T_111() {
  info 'sequencial T-111 — Simplificar saga e preservar SSE no Order Workflow'
  if rodar_tarefa seq 'T-111' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-111 — "Simplificar saga e preservar SSE no Order Workflow"
  critérios/refs: AC-143 (Idempotência concorrente ponta a ponta), AC-144 (Reutilização conflitante é recusada), AC-145 (Participantes comunicam-se por RabbitMQ), AC-146 (Subscription pode preceder o checkout), AC-147 (Stream protege ownership)
  arquivos permitidos (e seus testes): apps/order-workflow-subgraph/src/saga, apps/order-workflow-subgraph/src/inbox, apps/order-workflow-subgraph/src/outbox, apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/persistence, apps/order-workflow-subgraph/src/messaging
  mensagem de commit: "T-111 transaction-federation-refactor: Simplificar saga e preservar SSE no Order Workflow"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-111 transaction-federation-refactor: Simplificar saga e preservar SSE no Order Workflow (auto-commit do plano)'
    fi
    marcar_concluidas T-111
    verde "✔ T-111 concluída"
    return 0
  fi
  vermelho "✘ T-111 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-111"
  FALHAS="$FALHAS T-111"
  return 1
}

# ── sequencial T-112 (ordem do tasks.md) ──
executar_seq_T_112() {
  info 'sequencial T-112 — Isolar Payment, Inventory e porta de provedor'
  if rodar_tarefa seq 'T-112' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-112 — "Isolar Payment, Inventory e porta de provedor"
  critérios/refs: AC-145 (Participantes comunicam-se por RabbitMQ), AC-148 (Payment depende de uma porta de provedor), AC-149 (Inventory permanece participante separado)
  arquivos permitidos (e seus testes): apps/payment-processor/src/main/java/dev/desafio/payment, apps/payment-processor/src/main/java/dev/desafio/inventory, apps/payment-processor/src/test/java/dev/desafio/payment, apps/payment-processor/src/test/java/dev/desafio/inventory
  mensagem de commit: "T-112 transaction-federation-refactor: Isolar Payment, Inventory e porta de provedor"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-112 transaction-federation-refactor: Isolar Payment, Inventory e porta de provedor (auto-commit do plano)'
    fi
    marcar_concluidas T-112
    verde "✔ T-112 concluída"
    return 0
  fi
  vermelho "✘ T-112 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-112"
  FALHAS="$FALHAS T-112"
  return 1
}

# ── sequencial T-113 (ordem do tasks.md) ──
executar_seq_T_113() {
  info 'sequencial T-113 — Reconectar Gateway, MCP, compose e supergraph'
  if rodar_tarefa seq 'T-113' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-113 — "Reconectar Gateway, MCP, compose e supergraph"
  critérios/refs: AC-139 (Operações comerciais pertencem ao WordPress), AC-141 (Order Workflow é um serviço independente), AC-146 (Subscription pode preceder o checkout), AC-147 (Stream protege ownership)
  arquivos permitidos (e seus testes): apps/gateway, libs/gateway, apps/apollo-mcp, compose.yaml, libs/contracts/graphql/supergraph.yaml, test/gateway-order-workflow.test.mjs
  mensagem de commit: "T-113 transaction-federation-refactor: Reconectar Gateway, MCP, compose e supergraph"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-113 transaction-federation-refactor: Reconectar Gateway, MCP, compose e supergraph (auto-commit do plano)'
    fi
    marcar_concluidas T-113
    verde "✔ T-113 concluída"
    return 0
  fi
  vermelho "✘ T-113 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-113"
  FALHAS="$FALHAS T-113"
  return 1
}

# ── sequencial T-114 (ordem do tasks.md) ──
executar_seq_T_114() {
  info 'sequencial T-114 — Registrar ADRs e plano do pagamento real'
  if rodar_tarefa seq 'T-114' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-114 — "Registrar ADRs e plano do pagamento real"
  critérios/refs: AC-148 (Payment depende de uma porta de provedor), AC-149 (Inventory permanece participante separado), AC-150 (ADR registra alternativas e lacunas)
  arquivos permitidos (e seus testes): docs/adrs/008-native-commerce-and-order-workflow.md, docs/adrs/009-payment-provider-port.md, README.md, docs/prds/01-arquitetura-e-dominio.md, docs/prds/04-commerce-saga-e-realtime.md
  mensagem de commit: "T-114 transaction-federation-refactor: Registrar ADRs e plano do pagamento real"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-luna' low >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-114 transaction-federation-refactor: Registrar ADRs e plano do pagamento real (auto-commit do plano)'
    fi
    marcar_concluidas T-114
    verde "✔ T-114 concluída"
    return 0
  fi
  vermelho "✘ T-114 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-114"
  FALHAS="$FALHAS T-114"
  return 1
}

# ── sequencial T-115 (ordem do tasks.md) ──
executar_seq_T_115() {
  info 'sequencial T-115 — Fechar E2E, ESLint, composição e auditoria'
  if rodar_tarefa seq 'T-115' 'Você executa UMA tarefa da feature "transaction-federation-refactor" (fluxo onp-spec, spec-anchored).
Leia primeiro: .spec/features/transaction-federation-refactor/spec.md, .spec/features/transaction-federation-refactor/tasks.md e .spec/constituicao.md.

Sua tarefa (somente ela):
T-115 — "Fechar E2E, ESLint, composição e auditoria"
  critérios/refs: AC-143 (Idempotência concorrente ponta a ponta), AC-144 (Reutilização conflitante é recusada), AC-145 (Participantes comunicam-se por RabbitMQ), AC-146 (Subscription pode preceder o checkout), AC-147 (Stream protege ownership), AC-151 (Gates permanecem verdes)
  arquivos permitidos (e seus testes): apps/e2e/src/journey.ts, test/order-workflow-e2e.test.mjs, test/order-workflow-architecture.spec.test.js, .spec/verification/transaction-federation-refactor.json
  mensagem de commit: "T-115 transaction-federation-refactor: Fechar E2E, ESLint, composição e auditoria"

Regras inegociáveis:
- Todo critério de aceite referenciado vira teste com @spec:AC-xxx no título.
- NUNCA enfraqueça, pule (skip/todo) ou apague um teste para passar — teste pulado não é prova e o audit acusa.
- Rode os testes localmente com `pnpm test:spec && corepack pnpm@10.17.1 exec vitest run apps/e2e/src/milestone-7.e2e.test.ts --reporter=tap --hookTimeout=600000 --testTimeout=600000` até passarem.
- NÃO edite tasks.md, NÃO rode onp-spec verify/audit e NÃO toque em outras tarefas — o orquestrador cuida disso.
- Ao final de CADA tarefa: `git add` só no que você tocou e um commit próprio.' 'gpt-5.6-sol' high >> "$LOG_DIR/seq.log" 2>&1; then
    # commit de segurança se o agente esqueceu (rastreabilidade > perfeição)
    if [ -n "$(git status --porcelain)" ]; then
      git add -A && git commit -q -m 'T-115 transaction-federation-refactor: Fechar E2E, ESLint, composição e auditoria (auto-commit do plano)'
    fi
    marcar_concluidas T-115
    verde "✔ T-115 concluída"
    return 0
  fi
  vermelho "✘ T-115 falhou (log: $LOG_DIR/seq.log)"
  amarelo "  reexecute só ela: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --seq T-115"
  FALHAS="$FALHAS T-115"
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
      amarelo "  para o veredito: bash .spec/features/transaction-federation-refactor/executar-tarefas.sh --gate"
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
  executar_seq_T_108 || true
  executar_seq_T_109 || true
  executar_seq_T_110 || true
  executar_seq_T_111 || true
  executar_seq_T_112 || true
  executar_seq_T_113 || true
  executar_seq_T_114 || true
  executar_seq_T_115 || true
  encerrar tudo
}

listar() {
  echo "execução: $RUN_ID (feature $FEATURE, branch $BASE_BRANCH)"
  echo "  seq       T-108 (sequencial)"
  echo "  seq       T-109 (sequencial)"
  echo "  seq       T-110 (sequencial)"
  echo "  seq       T-111 (sequencial)"
  echo "  seq       T-112 (sequencial)"
  echo "  seq       T-113 (sequencial)"
  echo "  seq       T-114 (sequencial)"
  echo "  seq       T-115 (sequencial)"
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
      T-108) evento --tipo inicio --escopo "seq:T-108"; iniciar_resumos; executar_seq_T_108 || true; encerrar "seq:T-108" ;;
      T-109) evento --tipo inicio --escopo "seq:T-109"; iniciar_resumos; executar_seq_T_109 || true; encerrar "seq:T-109" ;;
      T-110) evento --tipo inicio --escopo "seq:T-110"; iniciar_resumos; executar_seq_T_110 || true; encerrar "seq:T-110" ;;
      T-111) evento --tipo inicio --escopo "seq:T-111"; iniciar_resumos; executar_seq_T_111 || true; encerrar "seq:T-111" ;;
      T-112) evento --tipo inicio --escopo "seq:T-112"; iniciar_resumos; executar_seq_T_112 || true; encerrar "seq:T-112" ;;
      T-113) evento --tipo inicio --escopo "seq:T-113"; iniciar_resumos; executar_seq_T_113 || true; encerrar "seq:T-113" ;;
      T-114) evento --tipo inicio --escopo "seq:T-114"; iniciar_resumos; executar_seq_T_114 || true; encerrar "seq:T-114" ;;
      T-115) evento --tipo inicio --escopo "seq:T-115"; iniciar_resumos; executar_seq_T_115 || true; encerrar "seq:T-115" ;;
      *) falhar "tarefa sequencial desconhecida: '$ALVO' — veja as disponíveis com --listar" ;;
    esac ;;
esac
