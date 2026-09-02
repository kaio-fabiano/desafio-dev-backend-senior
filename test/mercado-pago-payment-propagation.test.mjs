import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv from 'ajv/dist/2020.js';

import {
  OrderSaga,
  OrderWorkflowState,
} from '../apps/order-workflow-subgraph/src/saga/order-saga.ts';

const contracts = 'libs/contracts/events';
const javaRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/payment';

async function validator(schemaName) {
  const [envelope, schema] = await Promise.all([
    readFile(`${contracts}/envelope.schema.json`, 'utf8').then(JSON.parse),
    readFile(`${contracts}/${schemaName}`, 'utf8').then(JSON.parse),
  ]);
  const ajv = new Ajv({ validateFormats: false });
  ajv.addSchema(envelope);
  return ajv.compile(schema);
}

function event(eventType, payload) {
  return {
    eventId: '650090b4-b0a7-4700-b14b-401c535a61c5',
    eventType,
    eventVersion: 'v1',
    occurredAt: '2026-09-02T12:00:00.000Z',
    operationKey: 'checkout-127',
    payload,
    traceContext: { traceId: '0'.repeat(32) },
  };
}

test('AC-161: Card boundaries accept a provider token and no raw Card fields @spec:AC-161', async () => {
  const [
    validate,
    graphQlContract,
    graphQlRuntime,
    command,
    consumer,
    listener,
  ] = await Promise.all([
    validator('payment-requested.v1.schema.json'),
    readFile('libs/contracts/graphql/payment/schema.graphql', 'utf8'),
    readFile(
      'apps/payment-federation/src/main/resources/graphql/payment.graphqls',
      'utf8',
    ),
    readFile(`${javaRoot}/application/command/AuthorizePayment.java`, 'utf8'),
    readFile(`${javaRoot}/adapter/messaging/PaymentConsumer.java`, 'utf8'),
    readFile(
      `${javaRoot}/adapter/messaging/PaymentRabbitListener.java`,
      'utf8',
    ),
  ]);
  const payload = {
    paymentId: 'payment-127',
    orderId: '127',
    method: 'CARD',
    amount: 19.9,
    currency: 'BRL',
    payerEmail: 'buyer@example.test',
    providerToken: 'provider-token-127',
    paymentMethodId: 'visa',
  };

  assert.equal(validate(event('payment.requested', payload)), true);
  assert.equal(
    validate(
      event('payment.requested', {
        ...payload,
        cardNumber: '4111111111111111',
        securityCode: '123',
      }),
    ),
    false,
  );
  for (const source of [
    graphQlContract,
    graphQlRuntime,
    command,
    consumer,
    listener,
  ]) {
    assert.match(source, /providerToken/);
    assert.match(source, /payerEmail/);
    assert.match(source, /paymentMethodId/);
    assert.doesNotMatch(
      source,
      /\b(?:pan|cardNumber|card_number|securityCode|security_code|cvv|cvc)\b/i,
    );
  }
  assert.match(
    command,
    /method == Payment\.Method\.CARD[\s\S]*providerToken = required\(providerToken/,
  );
  assert.match(command, /Pix payments do not accept Card provider fields/);
  assert.doesNotMatch(
    listener,
    /LOG\.(?:info|warn|error)\([^\n]*providerToken/,
  );
});

test('AC-162: Pix outcomes carry Mercado Pago reference and copy-and-paste code @spec:AC-162', async () => {
  const validate = await validator('payment-pix-generated.v1.schema.json');
  const payload = {
    paymentId: 'payment-127',
    orderId: '127',
    providerReference: '987654321',
    pixCode: '00020101021226890014br.gov.bcb.pix',
  };

  assert.equal(validate(event('payment.pix-generated', payload)), true);
  assert.equal(
    validate(
      event('payment.pix-generated', {
        ...payload,
        providerReference: undefined,
      }),
    ),
    false,
  );

  const transition = new OrderSaga().transition(
    {
      id: 'workflow-127',
      wooOrderId: '127',
      state: OrderWorkflowState.Created,
    },
    { eventId: 'pix-127', eventType: 'payment.pix-generated', payload },
  );
  assert.equal(transition.kind, 'applied');
  assert.equal(transition.pixCode, payload.pixCode);
});

test('AC-164: financial transitions require the authoritative provider reference @spec:AC-164', async () => {
  const [validate, listener] = await Promise.all([
    validator('payment-authorized.v1.schema.json'),
    readFile(
      `${javaRoot}/adapter/messaging/PaymentRabbitListener.java`,
      'utf8',
    ),
  ]);
  const payload = {
    paymentId: 'payment-127',
    orderId: '127',
    providerReference: '987654321',
  };

  assert.equal(validate(event('payment.authorized', payload)), true);
  assert.equal(
    validate(
      event('payment.authorized', { ...payload, providerReference: undefined }),
    ),
    false,
  );
  assert.throws(
    () =>
      new OrderSaga().transition(
        {
          id: 'workflow-127',
          wooOrderId: '127',
          state: OrderWorkflowState.Created,
        },
        {
          eventId: 'authorized-127',
          eventType: 'payment.authorized',
          payload: { paymentId: payload.paymentId, orderId: payload.orderId },
        },
      ),
    /providerReference/,
  );
  assert.match(listener, /result\.outgoingEvent\(\) != null/);
  assert.match(listener, /envelope\.put\([\s\S]*"traceContext"/);
});
