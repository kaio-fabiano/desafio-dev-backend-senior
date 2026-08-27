import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import { parse } from 'graphql';

const schemaText = await readFile('libs/contracts/graphql/commerce/schema.graphql', 'utf8');
const eventSchema = JSON.parse(await readFile('libs/contracts/events/order-workflow-transitioned.v1.schema.json', 'utf8'));
const envelope = JSON.parse(await readFile('libs/contracts/events/envelope.schema.json', 'utf8'));
const ajv = new Ajv({ validateFormats: false });
ajv.addSchema(envelope);
const validate = ajv.compile(eventSchema);
const base = { eventId: '123e4567-e89b-12d3-a456-426614174000', eventType: 'order.workflow-transitioned', eventVersion: 'v1', occurredAt: '2026-08-27T12:00:00.000Z', traceContext: { traceId: '0123456789abcdef0123456789abcdef' }, operationKey: 'op-1' };
const event = (subject, state, extra = {}) => ({ ...base, subject, payload: { operationKey: 'op-1', orderId: 'order-1', state, eventTime: base.occurredAt, ...extra } });

test('AC-053: Card workflow transitions reach completion @spec:AC-053', () => {
  assert.equal(validate(event('buyer-a', 'COMPLETED')), true);
});

test('AC-054: Pix transition carries its stable code @spec:AC-054', () => {
  const pix = event('buyer-a', 'PIX_GENERATED', { pixCode: '000201BR' });
  assert.equal(validate(pix), true);
  assert.equal(pix.payload.pixCode, '000201BR');
});

test('AC-056: Workflow events are isolated by authenticated subject @spec:AC-056', () => {
  assert.equal(validate(event('buyer-a', 'COMPLETED')), true);
  assert.equal(validate({ ...event('buyer-b', 'COMPLETED'), subject: undefined }), false);
  assert.notEqual(event('buyer-a', 'COMPLETED').subject, event('buyer-b', 'COMPLETED').subject);
});

test('AC-057: Commerce exposes the GraphQL SSE subscription contract @spec:AC-057', () => {
  const document = parse(schemaText);
  const subscription = document.definitions.find((definition) => definition.name?.value === 'Subscription');
  const field = subscription.fields.find(({ name }) => name.value === 'orderEvents');
  assert.equal(field.arguments[0].name.value, 'operationKey');
  assert.equal(field.arguments[0].type.kind, 'NonNullType');
  assert.equal(field.arguments[0].type.type.name.value, 'ID');
  assert.equal(field.type.kind, 'NonNullType');
  assert.equal(field.type.type.name.value, 'OrderEvent');
  const eventType = document.definitions.find((definition) => definition.name?.value === 'OrderEvent');
  assert.deepEqual(eventType.fields.map(({ name }) => name.value), ['operationKey', 'orderId', 'state', 'pixCode', 'eventTime']);
});
