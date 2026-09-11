# Tasks: Align wordpress cart product edge

> feature: align-wordpress-cart-product-edge

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-307 — Align cart product contracts with WooGraphQL [concluida]
- Refs: US-160, AC-356
- Arquivos: libs/contracts/graphql/wordpress/schema.graphql, apps/apollo-mcp/schema.graphql, apps/apollo-mcp/operations/add-to-cart.graphql, apps/apollo-mcp/operations/get-my-cart.graphql, test/wordpress-native-commerce.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Bounded context: Commercial cart contract at the WordPress adapter boundary. Use case: add cart items and read their product details through federated GraphQL. Aggregate: none; this is a transport contract correction with no state transition. Invariants: WordPress remains the cart owner, product details are selected only through `product.node`, and authentication/session behavior is unchanged. Consistency boundary: the versioned WordPress and Apollo MCP schemas plus the two curated cart operations. Affected ports: the federated WordPress GraphQL contract and Apollo MCP GraphQL operation contract; no application port changes. Follow Red, Green, Refactor with one focused regression test, then run the required repository gates.
