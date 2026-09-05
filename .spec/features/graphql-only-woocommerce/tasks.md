# Tasks: GraphQL-only WooCommerce integration

> feature: graphql-only-woocommerce

## T-200 — Replace the remaining WooCommerce REST integration [concluida]
- Refs: US-114, AC-241, AC-242, AC-243
- Arquivos: apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts, apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.spec.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.spec.ts, apps/e2e/src/environment.ts, apps/e2e/src/journey.ts, apps/wordpress-integration/plugins/order-workflow-reconciliation/order-workflow-reconciliation.php, apps/wordpress-integration/scripts/install-plugins.sh, apps/wordpress-integration/scripts/production-entrypoint.sh, compose.yaml, infra/sst.config.ts, docs/adrs/003-wordpress-federation.md, docs/adrs/006-woocommerce-idempotent-checkout.md, docs/adrs/008-native-commerce-and-order-workflow.md, docs/runbooks/deployment.md, test/delivery-closure-rabbitmq.test.mjs, test/mercado-pago-production-deployment.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/milestone-8-wordpress-inventory-plugin.test.mjs, test/production-happy-path-hardening.spec.test.js, test/wordpress-native-commerce.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Follow Red, Green, and Refactor. Reuse the pinned extension's native `orders(where: { search })` query and the existing search-hook plugin; add only the service identity needed to authenticate that query. Preserve exact metadata validation and checkout recovery while removing REST consumer keys and every `/wp-json/wc` call from application and acceptance HTTP paths. Do not add a GraphQL extension or another abstraction.
