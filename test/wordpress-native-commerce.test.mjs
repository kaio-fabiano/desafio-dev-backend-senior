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
  assert.doesNotMatch(workflow, /\bCommerceOrderConnection\b/);
});

test('AC-140: Order Workflow delegates order creation to WooGraphQL checkout @spec:AC-140', async () => {
  const adapter = await readFile(
    'apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts',
    'utf8',
  );

  assert.match(adapter, /mutation\s+Checkout|checkout\s*\(/);
  assert.match(adapter, /\/graphql/);
  assert.doesNotMatch(adapter, /\/wp-json\/wc\/v3\/orders/);
  assert.doesNotMatch(adapter, /consumerSecret|consumer_key/i);
});
