import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OutboxPublisher } from '../apps/commerce-subgraph/src/outbox/outbox.publisher.ts';

const event = () => ({
  eventType: 'checkout.requested',
  id: 'event-1',
  occurredAt: new Date('2026-08-27T12:00:00.000Z'),
  payload: { checkoutId: 'checkout-1' },
  publicationAttempts: 0,
  workflowId: 'workflow-1',
});

function harness(publish) {
  const unsent = [event()];
  const attempts = [];
  const sent = [];
  const transaction = {};
  const entityManager = {
    async transactional(callback) {
      return callback(transaction);
    },
  };
  const repository = {
    async claimUnsent(received, limit) {
      assert.equal(received, transaction);
      assert.equal(limit, 50);
      return unsent;
    },
    async markPublicationAttempt(received, eventId) {
      assert.equal(received, transaction);
      attempts.push(eventId);
    },
    async markSent(received, eventId) {
      assert.equal(received, transaction);
      sent.push(eventId);
      unsent.splice(0, 1);
    },
  };
  return {
    attempts,
    publisher: new OutboxPublisher(entityManager, repository, { publish }),
    sent,
    unsent,
  };
}

test('AC-041: outbox rows are sent only after publisher confirmation @spec:AC-041', async () => {
  let confirm;
  const pendingConfirm = new Promise((resolve) => {
    confirm = resolve;
  });
  const { attempts, publisher, sent } = harness(async (message) => {
    assert.deepEqual(message, {
      correlationId: 'workflow-1',
      eventId: 'event-1',
      eventType: 'checkout.requested',
      occurredAt: '2026-08-27T12:00:00.000Z',
      payload: { checkoutId: 'checkout-1' },
    });
    await pendingConfirm;
  });

  const publishing = publisher.publishBatch();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(attempts, ['event-1']);
  assert.deepEqual(sent, []);

  confirm();
  assert.equal(await publishing, 1);
  assert.deepEqual(sent, ['event-1']);
});

test('AC-041: unconfirmed outbox rows remain eligible for retry @spec:AC-041', async () => {
  const { attempts, publisher, sent, unsent } = harness(async () => {
    throw new Error('publisher confirm rejected');
  });

  await assert.rejects(publisher.publishBatch(), /publisher confirm rejected/);
  assert.deepEqual(attempts, ['event-1']);
  assert.deepEqual(sent, []);
  assert.equal(unsent.length, 1);
});
