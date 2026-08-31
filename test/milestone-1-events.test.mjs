import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../libs/contracts/events/', import.meta.url);
const envelope = JSON.parse(await readFile(new URL('envelope.schema.json', root)));
const schemas = await Promise.all(['checkout-requested.v1', 'payment-authorized.v1', 'payment-failed.v1'].map(async name => [name, JSON.parse(await readFile(new URL(`${name}.schema.json`, root)))]));

const valid = (schema, event) => {
  const required = [...envelope.required, ...schema.allOf[1].required];
  if (required.some(key => event[key] === undefined)) return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(event.eventId)) return false;
  if (!/^v[1-9][0-9]*$/.test(event.eventVersion) || !Date.parse(event.occurredAt)) return false;
  if (!/^[0-9a-f]{32}$/.test(event.traceContext?.traceId) || !event.operationKey) return false;
  const payloadSchema = schema.allOf[1].properties.payload;
  return event.eventType === schema.allOf[1].properties.eventType.const && event.eventVersion === 'v1' && payloadSchema.required.every(key => event.payload?.[key] !== undefined) && Object.keys(event.payload ?? {}).every(key => payloadSchema.properties[key]);
};

test('AC-021: Valid events pass and malformed events fail @spec:AC-021', () => {
  for (const [name, schema] of schemas) {
    const event = { eventId: '123e4567-e89b-12d3-a456-426614174000', eventType: schema.allOf[1].properties.eventType.const, eventVersion: 'v1', occurredAt: '2026-08-27T12:00:00.000Z', traceContext: { traceId: '0123456789abcdef0123456789abcdef' }, operationKey: 'checkout-123', payload: name === 'checkout-requested.v1' ? { checkoutId: 'checkout-123' } : { paymentId: 'payment-123', ...(name === 'payment-failed.v1' ? { reason: 'declined' } : {}) } };
    assert.equal(valid(schema, event), true);
    assert.equal(valid(schema, { ...event, operationKey: undefined }), false);
    assert.equal(valid(schema, { ...event, eventVersion: 'v2' }), false);
  }
});
