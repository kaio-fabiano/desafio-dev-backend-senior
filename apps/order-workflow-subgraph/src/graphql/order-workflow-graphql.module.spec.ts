import { RequestMethod, type Provider } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  CHECKOUT_REPOSITORY,
  OUTBOX_REPOSITORY,
  WOO_CHECKOUT,
} from '../checkout/checkout.tokens.ts';
import {
  ORDER_WORKFLOW_ENTITY_MANAGER,
  ORDER_WORKFLOW_ORM,
} from '../persistence/persistence.tokens.ts';
import { OrderEventBroker } from '../order-events/order-event-broker.ts';
import { OrderEventsSubscription } from '../order-events/order-events.subscription.ts';
import { PostgresOrderEventRelay } from '../order-events/postgres/postgres-order-event.relay.ts';
import { OrderWorkflowRuntimeLifecycle } from '../messaging/order-workflow-messaging.runtime.ts';
import {
  OrderWorkflowGraphqlModule,
  orderWorkflowRequestContext,
} from './order-workflow-graphql.module.ts';

describe('OrderWorkflowGraphqlModule', () => {
  it('does not own persistence or checkout providers', () => {
    const providers = Reflect.getMetadata(
      'providers',
      OrderWorkflowGraphqlModule,
    ) as Provider[];
    const ownedTokens = providers.flatMap((candidate) =>
      typeof candidate === 'object' && 'provide' in candidate
        ? [candidate.provide]
        : [],
    );

    expect(ownedTokens).not.toContain(ORDER_WORKFLOW_ORM);
    expect(ownedTokens).not.toContain(ORDER_WORKFLOW_ENTITY_MANAGER);
    expect(ownedTokens).not.toContain(CHECKOUT_REPOSITORY);
    expect(ownedTokens).not.toContain(OUTBOX_REPOSITORY);
    expect(ownedTokens).not.toContain(WOO_CHECKOUT);
    expect(providers).not.toContain(OrderEventBroker);
    expect(ownedTokens).not.toContain(OrderEventsSubscription);
    expect(ownedTokens).not.toContain(PostgresOrderEventRelay);
    expect(providers).not.toContain(OrderWorkflowRuntimeLifecycle);
  });

  it('builds request context and registers the GraphQL SSE middleware', () => {
    expect(
      orderWorkflowRequestContext({
        req: {
          headers: {
            'cart-token': 'cart-231',
            cookie: 'session=231',
            'woocommerce-session': 'woo-231',
          },
        },
      }),
    ).toEqual({
      req: expect.any(Object),
      cartToken: 'cart-231',
      cookie: 'session=231',
      wooSession: 'woo-231',
    });

    const forRoutes = vi.fn();
    new OrderWorkflowGraphqlModule().configure({
      apply: vi.fn().mockReturnValue({ forRoutes }),
    } as never);

    expect(forRoutes).toHaveBeenCalledWith({
      path: 'graphql/stream',
      method: RequestMethod.ALL,
    });
  });
});
