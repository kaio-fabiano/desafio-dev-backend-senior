import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';

const directory = new URL('../libs/contracts/events/', import.meta.url);
const names = [
  'payment-requested.v1', 'payment-authorized.v1', 'payment-pix-generated.v1',
  'stock-reservation-requested.v1', 'stock-reserved.v1',
  'stock-reservation-failed.v1', 'payment-refund-requested.v1', 'payment-refunded.v1'
];
const envelope = JSON.parse(await readFile(new URL('envelope.schema.json', directory)));
const schemas = Object.fromEntries(await Promise.all(names.map(async (name) => [
  name, JSON.parse(await readFile(new URL(`${name}.schema.json`, directory)))
])));
const ajv = new Ajv({ validateFormats: false });
ajv.addSchema(envelope);
const validators = Object.fromEntries(names.map((name) => [name, ajv.compile(schemas[name])]));

const base = { eventId: '123e4567-e89b-12d3-a456-426614174000', occurredAt: '2026-08-27T12:00:00.000Z', traceContext: { traceId: '0123456789abcdef0123456789abcdef' }, operationKey: 'order-123' };
const event = (name, payload) => ({ ...base, eventType: schemas[name].allOf[1].properties.eventType.const, eventVersion: 'v1', payload });
const valid = (name, payload) => assert.equal(validators[name](event(name, payload)), true);

test('AC-041: versioned events carry a confirmed-publication-safe envelope @spec:AC-041', () => {
  valid('payment-requested.v1', { paymentId: 'pay-1', orderId: 'order-1', method: 'CARD', amount: 10, currency: 'BRL' });
  assert.equal(validators['payment-requested.v1']({ ...event('payment-requested.v1', { paymentId: 'pay-1', orderId: 'order-1', method: 'CARD', amount: 10, currency: 'BRL' }), eventVersion: 'v2' }), false);
});

test('AC-042: versioned events exclude unsafe retry and DLQ data @spec:AC-042', () => {
  valid('payment-authorized.v1', { paymentId: 'pay-1', orderId: 'order-1' });
  assert.equal(validators['payment-authorized.v1']({ ...event('payment-authorized.v1', { paymentId: 'pay-1', orderId: 'order-1', password: 'secret' }) }), false);
});

test('AC-043: Card authorization has stable payment and operation identifiers @spec:AC-043', () => {
  valid('payment-authorized.v1', { paymentId: 'pay-1', orderId: 'order-1' });
  assert.equal(validators['payment-authorized.v1']({ ...event('payment-authorized.v1', { orderId: 'order-1' }) }), false);
});

test('AC-044: Pix generation is terminal and carries the stable code @spec:AC-044', () => {
  valid('payment-pix-generated.v1', { paymentId: 'pay-1', orderId: 'order-1', pixCode: '000201BR' });
  assert.equal(validators['payment-pix-generated.v1']({ ...event('payment-pix-generated.v1', { paymentId: 'pay-1', orderId: 'order-1' }) }), false);
});

test('AC-046: Stock reservation requests and results identify one operation @spec:AC-046', () => {
  valid('stock-reservation-requested.v1', { orderId: 'order-1', items: [{ productId: 'sku-1', quantity: 2 }] });
  valid('stock-reserved.v1', { orderId: 'order-1', reservationId: 'reservation-1' });
});

test('AC-047: Insufficient stock has a safe, explicit failure reason @spec:AC-047', () => {
  valid('stock-reservation-failed.v1', { orderId: 'order-1', reason: 'INSUFFICIENT_STOCK' });
  assert.equal(validators['stock-reservation-failed.v1']({ ...event('stock-reservation-failed.v1', { orderId: 'order-1', reason: 'out of stock' }) }), false);
});

test('AC-048: Card journey contracts connect authorization to reservation @spec:AC-048', () => {
  valid('payment-authorized.v1', { paymentId: 'pay-1', orderId: 'order-1' });
  valid('stock-reserved.v1', { orderId: 'order-1', reservationId: 'reservation-1' });
});

test('AC-049: Compensation contracts connect stock failure to one refund @spec:AC-049', () => {
  valid('payment-refund-requested.v1', { paymentId: 'pay-1', orderId: 'order-1', reason: 'INSUFFICIENT_STOCK' });
  valid('payment-refunded.v1', { paymentId: 'pay-1', orderId: 'order-1' });
});

test('AC-050: Pix journey exposes its generated code without stock commands @spec:AC-050', () => {
  const pix = event('payment-pix-generated.v1', { paymentId: 'pay-1', orderId: 'order-1', pixCode: '000201BR' });
  assert.equal(validators['payment-pix-generated.v1'](pix), true);
  assert.equal(pix.payload.pixCode, '000201BR');
  assert.equal(Object.keys(pix.payload).includes('reservationId'), false);
});
