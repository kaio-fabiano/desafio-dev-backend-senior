import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InventoryService } from '../apps/stock-worker/src/inventory/inventory.service.ts';
import { createWooInventoryAdapter, InsufficientStockError } from '../apps/stock-worker/src/inventory/woo-inventory.adapter.ts';

const command = { eventId: 'event-1', operationKey: 'order-1', payload: { orderId: 'order-1', items: [{ productId: 'product-1', quantity: 2 }] } };

function harness(reserve) {
  const records = new Map();
  const published = [];
  return {
    records, published,
    service: new InventoryService({
      async find(id) { return records.get(id) ?? null; },
      async record(id, result) { if (records.has(id)) return false; records.set(id, result); return true; },
    }, { reserve }, { async publish(result) { published.push(result); } }),
  };
}

test('AC-046: Stock reservation changes WooCommerce once @spec:AC-046', async () => {
  let reservations = 0;
  const { service, published } = harness(async () => { reservations += 1; });
  const [first, duplicate] = await Promise.all([service.handle(command), service.handle(command)]);

  assert.equal(reservations, 1);
  assert.equal(published.length, 1);
  assert.equal(first.result.eventType, 'stock.reserved');
  assert.deepEqual(duplicate.result, first.result);
});

test('AC-047: Insufficient stock requests compensation @spec:AC-047', async () => {
  const { service, published } = harness(async () => { throw new InsufficientStockError('not enough'); });
  const outcome = await service.handle(command);

  assert.equal(outcome.result.eventType, 'stock.reservation-failed');
  assert.deepEqual(outcome.result.payload, { orderId: 'order-1', reason: 'INSUFFICIENT_STOCK' });
  assert.equal(published.length, 1);
});

test('AC-047: Insufficient stock leaves every WooCommerce quantity untouched @spec:AC-047', async () => {
  const writes = [];
  const inventory = createWooInventoryAdapter({
    endpoint: 'http://woo.test', consumerKey: 'key', consumerSecret: 'secret',
    async request(url, options = {}) {
      if (options.method === 'PUT') writes.push([String(url), options.body]);
      const id = String(url).split('/').at(-1);
      return new Response(JSON.stringify({ id, stock_quantity: id === 'first' ? 3 : 1 }), { status: 200 });
    },
  });

  await assert.rejects(
    inventory.reserve([{ productId: 'first', quantity: 2 }, { productId: 'second', quantity: 2 }]),
    InsufficientStockError,
  );
  assert.deepEqual(writes, []);
});
