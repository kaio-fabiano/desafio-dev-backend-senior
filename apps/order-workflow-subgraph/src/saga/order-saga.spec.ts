import { describe, expect, it } from 'vitest';

import {
  OrderSaga,
  OrderWorkflowState,
  OutOfOrderSagaEventError,
  type OrderSagaEvent,
  type OrderWorkflowSnapshot,
} from './order-saga.ts';

describe('OrderSaga', () => {
  const saga = new OrderSaga();

  it('requests stock after card authorization @spec:AC-230', () => {
    expect(
      saga.transition(
        workflow(OrderWorkflowState.Created),
        event('payment.authorized', {
          orderId: 'order-230',
          paymentId: 'payment-230',
          providerReference: 'provider-230',
        }),
        { stockItems: [{ productId: 'product-230', quantity: 2 }] },
      ),
    ).toEqual({
      kind: 'applied',
      from: OrderWorkflowState.Created,
      states: [
        OrderWorkflowState.PaymentPending,
        OrderWorkflowState.PaymentAuthorized,
        OrderWorkflowState.StockPending,
      ],
      to: OrderWorkflowState.StockPending,
      paymentId: 'payment-230',
      command: {
        eventType: 'stock.reservation-requested',
        payload: {
          orderId: 'order-230',
          items: [{ productId: 'product-230', quantity: 2 }],
        },
      },
    });
  });

  it('requests a refund after inventory failure @spec:AC-230', () => {
    expect(
      saga.transition(
        workflow(OrderWorkflowState.StockPending, {
          paymentId: 'payment-230',
        }),
        event('stock.reservation-failed', {
          orderId: 'order-230',
          reason: 'OUT_OF_STOCK',
        }),
      ),
    ).toMatchObject({
      kind: 'applied',
      states: [
        OrderWorkflowState.StockFailed,
        OrderWorkflowState.RefundPending,
      ],
      to: OrderWorkflowState.RefundPending,
      command: {
        eventType: 'payment.refund-requested',
        payload: {
          orderId: 'order-230',
          paymentId: 'payment-230',
          reason: 'OUT_OF_STOCK',
        },
      },
    });
  });

  it.each([
    {
      type: 'payment.pix-generated' as const,
      from: OrderWorkflowState.Created,
      payload: {
        orderId: 'order-230',
        paymentId: 'payment-230',
        pixCode: 'pix-code',
        providerReference: 'provider-230',
      },
      to: OrderWorkflowState.PixGenerated,
    },
    {
      type: 'stock.reserved' as const,
      from: OrderWorkflowState.StockPending,
      payload: { orderId: 'order-230', reservationId: 'reservation-230' },
      to: OrderWorkflowState.Completed,
    },
    {
      type: 'payment.refunded' as const,
      from: OrderWorkflowState.RefundPending,
      payload: { orderId: 'order-230', paymentId: 'payment-230' },
      to: OrderWorkflowState.Cancelled,
    },
  ])(
    'applies the $type terminal path @spec:AC-230',
    ({ from, payload, to, type }) => {
      const result = saga.transition(
        workflow(from, { paymentId: 'payment-230' }),
        event(type, payload),
      );

      expect(result.kind).toBe('applied');
      expect(result.to).toBe(to);
    },
  );

  it('rejects an event that arrived before its prerequisite @spec:AC-230', () => {
    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.Created),
        event('stock.reserved', {
          orderId: 'order-230',
          reservationId: 'reservation-230',
        }),
      ),
    ).toThrow(OutOfOrderSagaEventError);
  });

  it('ignores a replay that cannot change terminal state @spec:AC-230', () => {
    expect(
      saga.transition(
        workflow(OrderWorkflowState.Completed),
        event('stock.reserved', {
          orderId: 'order-230',
          reservationId: 'reservation-230',
        }),
      ),
    ).toEqual({
      kind: 'ignored',
      from: OrderWorkflowState.Completed,
      states: [],
      to: OrderWorkflowState.Completed,
    });
  });

  it.each([
    [
      { orderId: '', paymentId: 'payment-230', providerReference: 'ref' },
      'orderId',
    ],
    [
      { orderId: 'order-230', paymentId: '', providerReference: 'ref' },
      'paymentId',
    ],
    [
      { orderId: 'order-230', paymentId: 'payment-230', providerReference: '' },
      'providerReference',
    ],
  ])(
    'rejects malformed payment authorization payloads @spec:AC-230',
    (payload, field) => {
      expect(() =>
        saga.transition(
          workflow(OrderWorkflowState.Created),
          event('payment.authorized', payload),
          { stockItems: [{ productId: 'product-230', quantity: 1 }] },
        ),
      ).toThrow(field);
    },
  );

  it('rejects invalid stock items and mismatched refunds @spec:AC-230', () => {
    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.Created),
        event('payment.authorized', {
          orderId: 'order-230',
          paymentId: 'payment-230',
          providerReference: 'provider-230',
        }),
      ),
    ).toThrow('at least one order item');

    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.Created),
        event('payment.authorized', {
          orderId: 'order-230',
          paymentId: 'payment-230',
          providerReference: 'provider-230',
        }),
        { stockItems: [{ productId: '', quantity: 0 }] },
      ),
    ).toThrow('invalid order item');

    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.RefundPending, {
          paymentId: 'payment-230',
        }),
        event('payment.refunded', {
          orderId: 'order-230',
          paymentId: 'other-payment',
        }),
      ),
    ).toThrow('does not match');
  });

  it.each([
    [{ productId: 'product-230', quantity: 1.5 }, 'invalid order item'],
    [{ productId: 'product-230', quantity: 0 }, 'invalid order item'],
  ])('rejects each invalid stock quantity form @spec:AC-230', (item, error) => {
    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.Created),
        event('payment.authorized', {
          orderId: 'order-230',
          paymentId: 'payment-230',
          providerReference: 'provider-230',
        }),
        { stockItems: [item] },
      ),
    ).toThrow(error);
  });

  it('rejects non-string required metadata @spec:AC-230', () => {
    expect(() =>
      saga.transition(
        workflow(OrderWorkflowState.StockPending),
        event('stock.reserved', { orderId: 230, reservationId: 'valid' }),
      ),
    ).toThrow('orderId');
  });
});

function workflow(
  state: OrderWorkflowState,
  fields: Partial<OrderWorkflowSnapshot> = {},
): OrderWorkflowSnapshot {
  return {
    id: 'workflow-230',
    wooOrderId: 'order-230',
    state,
    ...fields,
  };
}

function event(
  eventType: OrderSagaEvent['eventType'],
  payload: Record<string, unknown>,
): OrderSagaEvent {
  return { eventId: 'event-230', eventType, payload };
}
