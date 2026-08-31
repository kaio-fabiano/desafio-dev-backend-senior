import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createProductLoader } from '../apps/gateway/src/catalog/product-loader.ts';
import { createCatalogRequestMetrics } from '../apps/gateway/src/catalog/request-metrics.ts';

test('AC-032: Federated entity loads are batched per request @spec:AC-032', async () => {
  const products = new Map([
    ['p1', { id: 'p1' }],
    ['p2', { id: 'p2' }],
  ]);
  const firstMetrics = createCatalogRequestMetrics();
  const firstLoader = createProductLoader(
    async (ids) => ids.map((id) => products.get(id) ?? null),
    firstMetrics,
  );
  assert.deepEqual(await Promise.all([firstLoader.load('p2'), firstLoader.load('p1')]), [
    { id: 'p2' },
    { id: 'p1' },
  ]);
  assert.deepEqual(firstMetrics, { calls: 1, batches: [2] });

  const secondMetrics = createCatalogRequestMetrics();
  const secondLoader = createProductLoader(
    async (ids) => ids.map((id) => products.get(id) ?? null),
    secondMetrics,
  );
  await secondLoader.load('p1');
  assert.deepEqual(secondMetrics, { calls: 1, batches: [1] });
});
