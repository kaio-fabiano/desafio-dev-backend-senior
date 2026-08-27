import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CartAuthorizationError, CartInputError, CartService } from '../apps/commerce-subgraph/src/cart/cart.service.ts';
import { createWooCartAdapter } from '../apps/commerce-subgraph/src/cart/woo-cart.adapter.ts';

test('AC-033: Cart mutations use the authenticated buyer @spec:AC-033', async () => {
  const requests = [];
  const adapter = createWooCartAdapter('https://wordpress.example.test', async (url, init) => {
    requests.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return Response.json({ items: [{ key: 'line-1', quantity: 2 }] });
  });
  const service = new CartService(adapter);

  const added = await service.addItem('buyer-from-token', { productId: 42, quantity: 2 });
  const removed = await service.removeItem('buyer-from-token', { itemKey: 'line-1', quantity: 1 });

  assert.equal(added.subject, 'buyer-from-token');
  assert.equal(removed.subject, 'buyer-from-token');
  assert.deepEqual(
    requests.map(({ url, headers, body }) => ({
      path: new URL(url).pathname,
      subject: headers['x-authenticated-subject'],
      body,
    })),
    [
      {
        path: '/wp-json/wc/store/v1/cart/add-item',
        subject: 'buyer-from-token',
        body: { id: 42, quantity: 2 },
      },
      {
        path: '/wp-json/wc/store/v1/cart/remove-item',
        subject: 'buyer-from-token',
        body: { key: 'line-1', quantity: 1 },
      },
    ],
  );
});

test('AC-034: Invalid cart changes are rejected without mutation @spec:AC-034', async () => {
  const calls = [];
  const service = new CartService({
    async addItem(subject, input) {
      calls.push({ subject, input });
      return { subject };
    },
    async removeItem(subject, input) {
      calls.push({ subject, input });
      return { subject };
    },
  });

  for (const quantity of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => service.addItem('buyer-from-token', { productId: 42, quantity }), CartInputError);
  }
  assert.throws(
    () => service.removeItem('buyer-from-token', {
      itemKey: 'line-1',
      quantity: 1,
      subject: 'another-buyer',
    }),
    CartAuthorizationError,
  );
  assert.deepEqual(calls, []);
});
