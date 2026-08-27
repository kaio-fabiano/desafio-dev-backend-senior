import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  WOO_OPERATION_REFERENCE_META_KEY,
  createWooOrderAdapter,
} from '../apps/commerce-subgraph/src/checkout/woo-order.adapter.ts';

function wooOrder(id, reference) {
  return {
    id,
    meta_data: [{ key: WOO_OPERATION_REFERENCE_META_KEY, value: reference }],
  };
}

test('AC-035: Sequential retries return the original WooCommerce order @spec:AC-035', async () => {
  const orders = [];
  const requests = [];
  const adapter = createWooOrderAdapter({
    endpoint: 'https://wordpress.example.test',
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    request: async (url, init) => {
      requests.push({ method: init?.method ?? 'GET', url: String(url) });
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        const created = { id: 73, ...body };
        orders.push(created);
        return Response.json(created, { status: 201 });
      }
      return Response.json(orders);
    },
  });

  const command = {
    reference: 'checkout-operation-1',
    order: {
      payment_method: 'cod',
      line_items: [{ product_id: 42, quantity: 1 }],
    },
  };
  const first = await adapter.createOrFind(command);
  const retry = await adapter.createOrFind(command);

  assert.equal(first.id, 73);
  assert.equal(retry.id, first.id);
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1);
  assert.deepEqual(first.meta_data, [
    { key: WOO_OPERATION_REFERENCE_META_KEY, value: command.reference },
  ]);
});

test('AC-038: Pending WooCommerce checkout is found by its stable reference @spec:AC-038', async () => {
  const remoteOrder = wooOrder(91, 'pending-operation-1');
  let creates = 0;
  const adapter = createWooOrderAdapter({
    endpoint: 'https://wordpress.example.test',
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    request: async (_url, init) => {
      if (init?.method === 'POST') creates += 1;
      return Response.json([remoteOrder]);
    },
  });

  const reconciled = await adapter.createOrFind({
    reference: 'pending-operation-1',
    order: { payment_method: 'cod' },
  });

  assert.equal(reconciled.id, remoteOrder.id);
  assert.equal(creates, 0);
});

test('the live checkout probe exercises the pinned WooCommerce REST API', async () => {
  const probe = await readFile(
    'apps/poc-wordpress/scripts/probe-checkout.mjs',
    'utf8',
  );
  assert.match(probe, /createWooOrderAdapter/);
  assert.match(probe, /createOrFind/);
  assert.match(probe, /assert\.equal\(retry\.id, first\.id\)/);
});
