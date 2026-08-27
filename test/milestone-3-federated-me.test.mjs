import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CommerceResolver } from '../apps/commerce-subgraph/src/graphql/commerce.resolver.ts';
import { createOrderLoader } from '../apps/gateway/src/catalog/order-loader.ts';
import { createProductLoader } from '../apps/gateway/src/catalog/product-loader.ts';
import { createCatalogRequestMetrics } from '../apps/gateway/src/catalog/request-metrics.ts';

const context = {
  subject: 'buyer-a',
  scopes: ['marketplace:read'],
  audience: ['gateway'],
  requestId: 'request-1',
};

test('AC-033: Cart mutations use the authenticated buyer @spec:AC-033', async () => {
  const calls = [];
  const cart = {
    async addItem(subject, input) {
      calls.push(['add', subject, input]);
      return { id: `cart:${subject}`, subject, quantity: input.quantity };
    },
    async removeItem(subject, input) {
      calls.push(['remove', subject, input]);
      return { id: `cart:${subject}`, subject, quantity: input.quantity };
    },
  };
  const resolver = new CommerceResolver(cart, async (subject, input) => {
    calls.push(['checkout', subject, input]);
    return { wooOrderId: '7' };
  }, async () => null);

  assert.equal((await resolver.addToCart(context, '41', 2)).subject, 'buyer-a');
  assert.equal((await resolver.removeFromCart(context, 'line-41', 1)).subject, 'buyer-a');
  assert.deepEqual(await resolver.checkout(context, { operationKey: 'operation-7', paymentMethod: 'PIX' }), {
    wooOrderId: '7',
  });
  assert.deepEqual(calls, [
    ['add', 'buyer-a', { productId: 41, quantity: 2 }],
    ['remove', 'buyer-a', { itemKey: 'line-41', quantity: 1 }],
    ['checkout', 'buyer-a', { operationKey: 'operation-7', paymentMethod: 'PIX' }],
  ]);
});

test('AC-040: Federated me returns orders, workflow, and products @spec:AC-040', async () => {
  const orderMetrics = createCatalogRequestMetrics();
  const productMetrics = createCatalogRequestMetrics();
  const orderLoader = createOrderLoader(async (requests) => requests.map(({ subject }) => ({
    edges: subject === 'buyer-a'
      ? [{ node: { id: 'order-7', wooOrderId: '7', productIds: ['p1', 'p2'] } }]
      : [],
    pageInfo: { hasNextPage: false, endCursor: null },
  })), orderMetrics);
  const productLoader = createProductLoader(async (ids) => ids.map((id) => ({ id })), productMetrics);
  const resolver = new CommerceResolver({}, async () => ({}), async (wooOrderId) => ({
    wooOrderId,
    state: 'PROCESSING',
  }));

  const [mine, theirs] = await Promise.all([
    orderLoader.load(context.subject, { first: 10 }),
    orderLoader.load('buyer-b', { first: 10 }),
  ]);
  const order = mine.edges[0].node;
  const [workflow, products] = await Promise.all([
    resolver.workflow(order),
    Promise.all(order.productIds.map((id) => productLoader.load(id))),
  ]);

  assert.deepEqual(mine.pageInfo, { hasNextPage: false, endCursor: null });
  assert.deepEqual(theirs.edges, []);
  assert.deepEqual(workflow, { wooOrderId: '7', state: 'PROCESSING' });
  assert.deepEqual(products, [{ id: 'p1' }, { id: 'p2' }]);
  assert.deepEqual(orderMetrics, { calls: 1, batches: [2] });
  assert.deepEqual(productMetrics, { calls: 1, batches: [2] });
});
