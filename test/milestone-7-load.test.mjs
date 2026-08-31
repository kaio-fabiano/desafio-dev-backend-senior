import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';

import { createOrderLoader } from '../apps/gateway/src/catalog/order-loader.ts';
import { createProductLoader } from '../apps/gateway/src/catalog/product-loader.ts';
import { createCatalogRequestMetrics } from '../apps/gateway/src/catalog/request-metrics.ts';

const p95 = (samples) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1];

test('AC-073: Warmed buyer probe stays under P95 budget with batched entity loads @spec:AC-073', async () => {
  const orderMetrics = createCatalogRequestMetrics();
  const productMetrics = createCatalogRequestMetrics();
  const orders = createOrderLoader(async (requests) => requests.map(() => ({
    edges: [{ node: { productIds: ['product-a', 'product-b'] } }],
  })), orderMetrics);
  const products = createProductLoader(async (ids) => ids.map((id) => ({ id })), productMetrics);
  const elapsed = [];

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const started = performance.now();
    const [first, second] = await Promise.all([
      orders.load(`buyer-${iteration}`, { first: 2 }),
      orders.load(`buyer-${iteration}-related`, { first: 2 }),
    ]);
    await Promise.all([...first.edges, ...second.edges].flatMap(({ node }) => node.productIds.map((id) => products.load(`${iteration}:${id}`))));
    elapsed.push(performance.now() - started);
  }

  assert.ok(p95(elapsed) < 500, `P95 was ${p95(elapsed).toFixed(2)}ms`);
  assert.deepEqual(orderMetrics.batches, Array(20).fill(2));
  assert.deepEqual(productMetrics.batches, Array(20).fill(2));
  assert.equal(orderMetrics.calls, 20);
  assert.equal(productMetrics.calls, 20);
});
