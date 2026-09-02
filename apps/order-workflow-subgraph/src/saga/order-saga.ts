export enum OrderWorkflowState {
  Created = 'CREATED',
  PaymentPending = 'PAYMENT_PENDING',
  PaymentAuthorized = 'PAYMENT_AUTHORIZED',
  StockPending = 'STOCK_PENDING',
  Completed = 'COMPLETED',
  StockFailed = 'STOCK_FAILED',
  RefundPending = 'REFUND_PENDING',
  Refunded = 'REFUNDED',
  Cancelled = 'CANCELLED',
  PixPending = 'PIX_PENDING',
  PixGenerated = 'PIX_GENERATED',
}

export type OrderSagaEventType =
  | 'payment.authorized'
  | 'payment.pix-generated'
  | 'payment.refunded'
  | 'stock.reservation-failed'
  | 'stock.reserved';

export interface OrderSagaEvent {
  eventId: string;
  eventType: OrderSagaEventType;
  payload: Record<string, unknown>;
}

export interface OrderWorkflowSnapshot {
  id: string;
  wooOrderId: string;
  state: OrderWorkflowState;
  paymentId?: string;
  pixCode?: string;
}

export interface StockItem {
  productId: string;
  quantity: number;
}

export interface OrderSagaContext {
  stockItems?: readonly StockItem[];
}

export interface SagaCommand {
  eventType: 'payment.refund-requested' | 'stock.reservation-requested';
  payload: Record<string, unknown>;
}

export type SagaTransition =
  | {
      kind: 'applied';
      from: OrderWorkflowState;
      states: readonly OrderWorkflowState[];
      to: OrderWorkflowState;
      command?: SagaCommand;
      paymentId?: string;
      pixCode?: string;
    }
  | {
      kind: 'ignored';
      from: OrderWorkflowState;
      states: readonly [];
      to: OrderWorkflowState;
    };

export type AppliedSagaTransition = Extract<
  SagaTransition,
  { kind: 'applied' }
>;
export type IgnoredSagaTransition = Extract<
  SagaTransition,
  { kind: 'ignored' }
>;

interface TransitionRule {
  from: readonly OrderWorkflowState[];
  future: readonly OrderWorkflowState[];
  path: readonly OrderWorkflowState[];
}

export const ORDER_SAGA_TRANSITIONS: Record<
  OrderSagaEventType,
  TransitionRule
> = {
  'payment.authorized': {
    from: [OrderWorkflowState.Created, OrderWorkflowState.PaymentPending],
    future: [],
    path: [
      OrderWorkflowState.PaymentPending,
      OrderWorkflowState.PaymentAuthorized,
      OrderWorkflowState.StockPending,
    ],
  },
  'stock.reserved': {
    from: [OrderWorkflowState.StockPending],
    future: [
      OrderWorkflowState.Created,
      OrderWorkflowState.PaymentPending,
      OrderWorkflowState.PaymentAuthorized,
    ],
    path: [OrderWorkflowState.Completed],
  },
  'stock.reservation-failed': {
    from: [OrderWorkflowState.StockPending],
    future: [
      OrderWorkflowState.Created,
      OrderWorkflowState.PaymentPending,
      OrderWorkflowState.PaymentAuthorized,
    ],
    path: [OrderWorkflowState.StockFailed, OrderWorkflowState.RefundPending],
  },
  'payment.refunded': {
    from: [OrderWorkflowState.RefundPending],
    future: [
      OrderWorkflowState.Created,
      OrderWorkflowState.PaymentPending,
      OrderWorkflowState.PaymentAuthorized,
      OrderWorkflowState.StockPending,
      OrderWorkflowState.StockFailed,
    ],
    path: [OrderWorkflowState.Refunded, OrderWorkflowState.Cancelled],
  },
  'payment.pix-generated': {
    from: [OrderWorkflowState.Created, OrderWorkflowState.PixPending],
    future: [],
    path: [OrderWorkflowState.PixPending, OrderWorkflowState.PixGenerated],
  },
};

export class OutOfOrderSagaEventError extends Error {}

export class OrderSaga {
  transition(
    workflow: OrderWorkflowSnapshot,
    event: OrderSagaEvent,
    context: OrderSagaContext = {},
  ): SagaTransition {
    const rule = ORDER_SAGA_TRANSITIONS[event.eventType];
    if (!rule.from.includes(workflow.state)) {
      if (rule.future.includes(workflow.state)) {
        throw new OutOfOrderSagaEventError(
          `${event.eventType} arrived before ${rule.from.join(' or ')}`,
        );
      }
      return {
        kind: 'ignored',
        from: workflow.state,
        states: [],
        to: workflow.state,
      };
    }

    const states =
      workflow.state === OrderWorkflowState.Created
        ? rule.path
        : rule.path.filter((state) => state !== workflow.state);
    const to = states.at(-1);
    if (!to)
      throw new Error(`Transition ${event.eventType} has no target state`);

    return {
      kind: 'applied',
      from: workflow.state,
      states,
      to,
      ...this.effect(workflow, event, context),
    };
  }

  private effect(
    workflow: OrderWorkflowSnapshot,
    event: OrderSagaEvent,
    context: OrderSagaContext,
  ): Pick<AppliedSagaTransition, 'command' | 'paymentId' | 'pixCode'> {
    const orderId = requiredString(event.payload.orderId, 'orderId');
    switch (event.eventType) {
      case 'payment.authorized': {
        const paymentId = requiredString(event.payload.paymentId, 'paymentId');
        requiredString(event.payload.providerReference, 'providerReference');
        const items = requiredStockItems(context.stockItems);
        return {
          paymentId,
          command: {
            eventType: 'stock.reservation-requested',
            payload: { orderId, items },
          },
        };
      }
      case 'stock.reservation-failed':
        return {
          command: {
            eventType: 'payment.refund-requested',
            payload: {
              orderId,
              paymentId: requiredString(workflow.paymentId, 'paymentId'),
              reason: requiredString(event.payload.reason, 'reason'),
            },
          },
        };
      case 'payment.pix-generated':
        requiredString(event.payload.providerReference, 'providerReference');
        return {
          paymentId: requiredString(event.payload.paymentId, 'paymentId'),
          pixCode: requiredString(event.payload.pixCode, 'pixCode'),
        };
      case 'payment.refunded': {
        const paymentId = requiredString(event.payload.paymentId, 'paymentId');
        if (paymentId !== workflow.paymentId) {
          throw new TypeError('Refunded payment does not match the workflow');
        }
        return {};
      }
      case 'stock.reserved':
        requiredString(event.payload.reservationId, 'reservationId');
        return {};
    }
  }
}

function requiredStockItems(
  items: readonly StockItem[] | undefined,
): StockItem[] {
  if (!items?.length) {
    throw new TypeError('Stock reservation requires at least one order item');
  }
  return items.map(({ productId, quantity }) => {
    if (!productId.trim() || !Number.isInteger(quantity) || quantity < 1) {
      throw new TypeError('Stock reservation contains an invalid order item');
    }
    return { productId, quantity };
  });
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Saga event ${field} must be a non-empty string`);
  }
  return value;
}
