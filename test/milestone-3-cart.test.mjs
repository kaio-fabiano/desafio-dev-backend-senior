import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CartAuthorizationError,
  CartInputError,
  CartService,
} from '../apps/commerce-subgraph/src/cart/cart.service.ts';
import {
  WooCartMutationError,
  createWooCartAdapter,
} from '../apps/commerce-subgraph/src/cart/woo-cart.adapter.ts';

function cartApi() {
  const carts = new Map();
  const requests = [];
  const tokens = new Map();
  let nextToken = 0;

  return {
    requests,
    async request(url, init = {}) {
      const path = new URL(url).pathname;
      const method = init.method ?? 'GET';
      const subject = init.headers?.['x-authenticated-subject'];
      const token = init.headers?.['cart-token'];
      const body = init.body ? JSON.parse(init.body) : undefined;
      requests.push({ path, method, subject, token, body });

      if (!tokens.has(subject)) tokens.set(subject, `cart-${++nextToken}`);
      if (token && token !== tokens.get(subject)) {
        return Response.json({ code: 'invalid-cart-token' }, { status: 403 });
      }

      const items = carts.get(subject) ?? [];
      if (method === 'POST' && path.endsWith('/add-item')) {
        const existing = items.find(({ id }) => id === body.id);
        if (existing) existing.quantity += body.quantity;
        else
          items.push({
            id: body.id,
            key: `line-${body.id}`,
            quantity: body.quantity,
          });
      }
      if (method === 'POST' && path.endsWith('/update-item')) {
        items.find(({ key }) => key === body.key).quantity = body.quantity;
      }
      if (method === 'POST' && path.endsWith('/remove-item')) {
        items.splice(
          items.findIndex(({ key }) => key === body.key),
          1,
        );
      }
      carts.set(subject, items);
      return Response.json(
        { items: items.map((item) => ({ ...item })) },
        { headers: { 'Cart-Token': tokens.get(subject) } },
      );
    },
  };
}

test('AC-033: Cart mutations use the authenticated buyer @spec:AC-033', async () => {
  const api = cartApi();
  const adapter = createWooCartAdapter(
    'https://wordpress.example.test',
    api.request,
  );
  const service = new CartService(adapter);

  const added = await service.addItem('buyer-from-token', {
    productId: 42,
    quantity: 2,
  });
  const updated = await service.removeItem('buyer-from-token', {
    itemKey: '42',
    quantity: 1,
  });
  const removed = await service.removeItem('buyer-from-token', {
    itemKey: '42',
    quantity: 1,
  });
  const current = await service.get('buyer-from-token');

  assert.equal(added.subject, 'buyer-from-token');
  assert.equal(added.id, 'buyer-from-token');
  assert.deepEqual(updated.items, [{ id: 42, key: 'line-42', quantity: 1 }]);
  assert.equal(removed.subject, 'buyer-from-token');
  assert.deepEqual(current.items, []);
  assert.deepEqual(
    api.requests.map(({ path, method, subject, token, body }) => ({
      path,
      method,
      subject,
      token,
      body,
    })),
    [
      {
        path: '/wp-json/wc/store/v1/cart',
        method: 'GET',
        subject: 'buyer-from-token',
        token: undefined,
        body: undefined,
      },
      {
        path: '/wp-json/wc/store/v1/cart/add-item',
        method: 'POST',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: { id: 42, quantity: 2 },
      },
      {
        path: '/wp-json/wc/store/v1/cart',
        method: 'GET',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: undefined,
      },
      {
        path: '/wp-json/wc/store/v1/cart/update-item',
        method: 'POST',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: { key: 'line-42', quantity: 1 },
      },
      {
        path: '/wp-json/wc/store/v1/cart',
        method: 'GET',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: undefined,
      },
      {
        path: '/wp-json/wc/store/v1/cart/remove-item',
        method: 'POST',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: { key: 'line-42' },
      },
      {
        path: '/wp-json/wc/store/v1/cart',
        method: 'GET',
        subject: 'buyer-from-token',
        token: 'cart-1',
        body: undefined,
      },
    ],
  );
});

test('cart token bootstrap is shared by concurrent mutations and isolated per buyer', async () => {
  const api = cartApi();
  const adapter = createWooCartAdapter(
    'https://wordpress.example.test',
    api.request,
  );

  await Promise.all([
    adapter.addItem('buyer-a', { productId: 42, quantity: 1 }),
    adapter.addItem('buyer-a', { productId: 84, quantity: 1 }),
  ]);
  await adapter.addItem('buyer-b', { productId: 42, quantity: 1 });

  assert.equal(
    api.requests.filter(
      ({ method, subject }) => method === 'GET' && subject === 'buyer-a',
    ).length,
    1,
  );
  assert.deepEqual(
    api.requests
      .filter(({ method }) => method === 'POST')
      .map(({ subject, token }) => [subject, token]),
    [
      ['buyer-a', 'cart-1'],
      ['buyer-a', 'cart-1'],
      ['buyer-b', 'cart-2'],
    ],
  );
});

test('expired cart tokens are refreshed only through safe GET requests', async () => {
  const requests = [];
  let token = 'cart-1';
  let rejectMutation = false;
  const adapter = createWooCartAdapter(
    'https://wordpress.example.test',
    async (url, init = {}) => {
      const method = init.method ?? 'GET';
      const sentToken = init.headers?.['cart-token'];
      requests.push({ method, sentToken });
      if (sentToken && sentToken !== token) {
        return Response.json({}, { status: 403 });
      }
      if (method === 'POST' && rejectMutation) {
        token = 'cart-3';
        rejectMutation = false;
        return Response.json({}, { status: 403 });
      }
      return Response.json({ items: [] }, { headers: { 'Cart-Token': token } });
    },
  );

  await adapter.get('buyer-a');
  token = 'cart-2';
  await adapter.get('buyer-a');
  assert.deepEqual(requests.slice(0, 3), [
    { method: 'GET', sentToken: undefined },
    { method: 'GET', sentToken: 'cart-1' },
    { method: 'GET', sentToken: undefined },
  ]);

  rejectMutation = true;
  await assert.rejects(
    adapter.addItem('buyer-a', { productId: 42, quantity: 1 }),
    WooCartMutationError,
  );
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1);
  await adapter.addItem('buyer-a', { productId: 42, quantity: 1 });
  assert.deepEqual(requests.slice(-2), [
    { method: 'GET', sentToken: undefined },
    { method: 'POST', sentToken: 'cart-3' },
  ]);
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
    assert.throws(
      () => service.addItem('buyer-from-token', { productId: 42, quantity }),
      CartInputError,
    );
  }
  assert.throws(
    () =>
      service.removeItem('buyer-from-token', {
        itemKey: 'line-1',
        quantity: 1,
        subject: 'another-buyer',
      }),
    CartAuthorizationError,
  );
  assert.deepEqual(calls, []);
});
