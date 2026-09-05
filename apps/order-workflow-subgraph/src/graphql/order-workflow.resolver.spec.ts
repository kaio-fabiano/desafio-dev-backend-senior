import { describe, expect, it, vi } from 'vitest';

import { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import type { OrderEventsSubscription } from '../order-events/order-events.subscription.ts';
import {
  OrderWorkflowResolver,
  OrderWorkflowSubscriptionResolver,
} from './order-workflow.resolver.ts';
import type { OrderWorkflowOperations } from './order-workflow.types.ts';

describe('OrderWorkflowResolver', () => {
  it('delegates checkout and owner-bound reads to the operations service @spec:AC-231', async () => {
    const operations = operationsMock();
    const resolver = new OrderWorkflowResolver(operations);
    const input = {
      operationKey: 'operation-231',
      payerEmail: 'buyer@example.test',
      paymentMethod: 'CARD' as const,
      paymentMethodId: 'visa',
      providerToken: 'provider-token',
    };
    const session = { cartToken: 'cart-231' };

    await resolver.checkout('buyer-231', input, session);
    await resolver.checkoutOperation('checkout-231', 'buyer-231');
    await resolver.workflow({ wooOrderId: '731' }, 'buyer-231');

    expect(operations.checkout).toHaveBeenCalledWith(
      'buyer-231',
      input,
      session,
    );
    expect(operations.findCheckout).toHaveBeenCalledWith(
      'buyer-231',
      'checkout-231',
    );
    expect(operations.findWorkflow).toHaveBeenCalledWith('buyer-231', '731');
  });

  it('returns an embedded workflow without another persistence lookup @spec:AC-231', () => {
    const operations = operationsMock();
    const workflow = new OrderWorkflow();
    const resolver = new OrderWorkflowResolver(operations);

    expect(
      resolver.workflow({ wooOrderId: '731', workflow }, 'buyer-231'),
    ).toBe(workflow);
    expect(operations.findWorkflow).not.toHaveBeenCalled();
  });

  it('binds subscriptions to the owner, operation key, and HTTP signal @spec:AC-231', () => {
    const subscribe = vi.fn().mockReturnValue({
      [Symbol.asyncIterator]() {
        return this;
      },
    });
    const resolver = new OrderWorkflowSubscriptionResolver({
      subscribe,
    } as unknown as OrderEventsSubscription);
    const signal = new AbortController().signal;

    resolver.orderEvents('buyer-231', 'operation-231', signal);

    expect(subscribe).toHaveBeenCalledWith('buyer-231', 'operation-231', {
      signal,
    });
  });
});

function operationsMock(): OrderWorkflowOperations {
  return {
    checkout: vi.fn().mockResolvedValue({}),
    findCheckout: vi.fn().mockResolvedValue(null),
    findWorkflow: vi.fn().mockResolvedValue(null),
  } as unknown as OrderWorkflowOperations;
}
