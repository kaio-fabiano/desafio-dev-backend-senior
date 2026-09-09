import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wordpressSchemaPath = 'libs/contracts/graphql/wordpress/schema.graphql';
const workflowSchemaPath =
  'libs/contracts/graphql/order-workflow/schema.graphql';

test('AC-139: WordPress owns native commerce operations @spec:AC-139', async () => {
  const [wordpress, workflow] = await Promise.all([
    readFile(wordpressSchemaPath, 'utf8'),
    readFile(workflowSchemaPath, 'utf8'),
  ]);

  for (const operation of [
    /products\s*\(/,
    /cart\s*:/,
    /customer\s*:/,
    /order\s*\(/,
    /addToCart\s*\(/,
    /checkout\s*\(/,
  ]) {
    assert.match(wordpress, operation);
  }

  assert.doesNotMatch(workflow, /\btype\s+(?:Cart|Product|Customer)\b/);
  assert.doesNotMatch(workflow, /extend\s+type\s+User[\s\S]*?\borders\s*\(/);
  assert.doesNotMatch(workflow, /\bOrderWorkflowOrderConnection\b/);
});

test('AC-140: Order Workflow delegates order creation and reconciliation to WooGraphQL @spec:AC-140 @spec:AC-241 @spec:AC-242', async () => {
  const paths = [
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java',
    'apps/e2e/src/journey.ts',
    'apps/wordpress-integration/scripts/production-entrypoint.sh',
    'compose.yaml',
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(path, 'utf8')),
  );
  const [adapter] = sources;

  assert.match(adapter, /mutation TransactionCheckout/);
  assert.match(adapter, /\/graphql/);
  assert.match(adapter, /"paymentMethod", "cod"/);
  assert.match(adapter, /query\s+FindOrderByTransactionReference/);
  assert.match(adapter, /orders\(first: 2, where: \{ search: \$reference \}\)/);
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /\/wp-json\/wc|WooCheckoutServiceCredentials|WOO_CONSUMER_(?:KEY|SECRET)/,
    );
  }
  assert.doesNotMatch(adapter, /register_rest_route|\/marketplace\/v1/);
});
