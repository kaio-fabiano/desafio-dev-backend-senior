import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInventoryWorker } from '../apps/stock-worker/src/main.ts';

test('AC-051: Crash after effect before acknowledgement is harmless @spec:AC-051', async () => {
  const records = new Map();
  let reservations = 0;
  let publications = 0;
  const worker = createInventoryWorker({
    inbox: {
      async find(id) { return records.get(id) ?? null; },
      async record(id, result) { if (records.has(id)) return false; records.set(id, result); return true; },
    },
    inventory: { async reserve() { reservations += 1; } },
    publisher: { async publish() { publications += 1; } },
  });
  const event = { eventId: 'redelivered-event', operationKey: 'order-2', payload: { orderId: 'order-2', items: [{ productId: 'product-2', quantity: 1 }] } };

  await assert.rejects(
    worker.consume(event, async () => { throw new Error('simulated crash before acknowledgement'); }),
    /simulated crash before acknowledgement/,
  );
  await worker.consume(event, async () => {});

  assert.equal(reservations, 1);
  assert.equal(publications, 1);
  assert.equal(records.size, 1);
});
