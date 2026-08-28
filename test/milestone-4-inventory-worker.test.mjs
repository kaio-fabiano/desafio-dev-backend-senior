import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

import { InventoryService } from '../apps/stock-worker/src/inventory/inventory.service.ts';
import {
  createWooInventoryAdapter,
  InsufficientStockError,
} from '../apps/stock-worker/src/inventory/woo-inventory.adapter.ts';

const command = {
  eventId: 'event-1',
  operationKey: 'order-1',
  payload: {
    orderId: 'order-1',
    items: [{ productId: 'product-1', quantity: 2 }],
  },
};

function harness(reserve) {
  const records = new Map();
  const published = [];
  return {
    records,
    published,
    service: new InventoryService(
      {
        async find(id) {
          return records.get(id) ?? null;
        },
        async record(id, result) {
          if (records.has(id)) return false;
          records.set(id, result);
          return true;
        },
      },
      { reserve },
      {
        async publish(result) {
          published.push(result);
        },
      },
    ),
  };
}

test('AC-046: Stock reservation changes WooCommerce once @spec:AC-046', async () => {
  let reservations = 0;
  const { service, published } = harness(async () => {
    reservations += 1;
  });
  const [first, duplicate] = await Promise.all([
    service.handle(command),
    service.handle(command),
  ]);

  assert.equal(reservations, 1);
  assert.equal(published.length, 1);
  assert.equal(first.result.eventType, 'stock.reserved');
  assert.deepEqual(duplicate.result, first.result);
});

test('AC-047: Insufficient stock requests compensation @spec:AC-047', async () => {
  const { service, published } = harness(async () => {
    throw new InsufficientStockError('not enough');
  });
  const outcome = await service.handle(command);

  assert.equal(outcome.result.eventType, 'stock.reservation-failed');
  assert.deepEqual(outcome.result.payload, {
    orderId: 'order-1',
    reason: 'INSUFFICIENT_STOCK',
  });
  assert.equal(published.length, 1);
});

test('AC-047: inventory reservation uses one authenticated batch boundary @spec:AC-047', async () => {
  const requests = [];
  const headers = [];
  const inventory = createWooInventoryAdapter({
    endpoint: 'http://woo.test',
    consumerKey: 'key',
    consumerSecret: 'secret',
    async request(url, options = {}) {
      headers.push(options.headers);
      requests.push([String(url), options]);
      return new Response(JSON.stringify({ code: 'insufficient_stock' }), {
        status: 409,
      });
    },
  });

  await assert.rejects(
    inventory.reserve([
      { productId: 'first', quantity: 2 },
      { productId: 'second', quantity: 2 },
    ]),
    InsufficientStockError,
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0][0], /marketplace\/v1\/inventory\/reserve$/);
  assert.deepEqual(JSON.parse(requests[0][1].body).items, [
    { productId: 'first', quantity: 2 },
    { productId: 'second', quantity: 2 },
  ]);
  assert.equal(headers[0].authorization, 'Basic a2V5OnNlY3JldA==');
  assert.equal(headers[0]['x-forwarded-proto'], 'https');
});

test('AC-047: the delivered adapter isolates and completes its HTTP request @spec:AC-047', async (context) => {
  const server = spawn(process.execPath, ['-e', `
    require('node:http').createServer((request, response) => {
      request.resume();
      request.on('end', () => response.end('{"reserved":true}'));
    }).listen(0, '127.0.0.1', function () { console.log(this.address().port); });
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
  context.after(() => server.kill('SIGTERM'));
  const port = await new Promise((resolve) =>
    server.stdout.once('data', (chunk) => resolve(Number(String(chunk).trim()))));
  const inventory = createWooInventoryAdapter({
    endpoint: `http://127.0.0.1:${port}`,
    consumerKey: 'key',
    consumerSecret: 'secret',
  });

  await inventory.reserve([{ productId: '1001', quantity: 1 }]);

});
