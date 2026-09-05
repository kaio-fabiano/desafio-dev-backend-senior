import type { EntityManager } from '@mikro-orm/core';
import { describe, expect, it, vi } from 'vitest';

import type { CheckoutService } from '../checkout/checkout.service.ts';
import {
  CheckoutOperation,
  CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import {
  OrderWorkflow,
  OrderWorkflowState,
} from '../persistence/entities/order-workflow.entity.ts';
import { OrderWorkflowOperationsService } from './order-workflow-operations.service.ts';

describe('OrderWorkflowOperationsService', () => {
  it('maps checkout output with the shared payment method and workflow @spec:AC-231', async () => {
    const workflow = Object.assign(new OrderWorkflow(), {
      pixCode: 'pix-231',
      state: OrderWorkflowState.PixGenerated,
    });
    const checkout = vi.fn().mockResolvedValue({ wooOrderId: '731' });
    const findOneOrFail = vi.fn().mockResolvedValue(workflow);
    const service = new OrderWorkflowOperationsService(
      { checkout } as unknown as CheckoutService,
      { findOneOrFail } as unknown as EntityManager,
    );
    const input = {
      operationKey: 'operation-231',
      payerEmail: 'buyer@example.test',
      paymentMethod: 'PIX' as const,
    };
    const session = { cartToken: 'cart-231' };

    await expect(
      service.checkout('buyer-231', input, session),
    ).resolves.toEqual({
      __typename: 'Order',
      id: Buffer.from('post:731').toString('base64'),
      paymentMethod: 'PIX',
      pixCode: 'pix-231',
      wooOrderId: '731',
      workflow: { state: OrderWorkflowState.PixGenerated },
    });
    expect(checkout).toHaveBeenCalledWith({
      subject: 'buyer-231',
      ...input,
      session,
    });
    expect(findOneOrFail).toHaveBeenCalledWith(OrderWorkflow, {
      wooOrderId: '731',
    });
  });

  it('keeps workflow and operation reads bound to the authenticated owner @spec:AC-231', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-231',
      operationKey: 'operation-231',
      status: CheckoutOperationStatus.CreatingWoo,
      subject: 'buyer-231',
    });
    const workflow = Object.assign(new OrderWorkflow(), {
      checkoutOperationId: operation.id,
    });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce(workflow)
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce(null);
    const service = new OrderWorkflowOperationsService(
      {} as CheckoutService,
      { findOne } as unknown as EntityManager,
    );

    await expect(service.findWorkflow('buyer-231', '731')).resolves.toBe(
      workflow,
    );
    await expect(
      service.findCheckout('buyer-231', operation.id),
    ).resolves.toMatchObject({
      id: operation.id,
      operationKey: operation.operationKey,
      status: 'PENDING',
    });
    await expect(
      service.findWorkflow('other-buyer', '731'),
    ).resolves.toBeNull();
    expect(findOne).toHaveBeenNthCalledWith(1, CheckoutOperation, {
      subject: 'buyer-231',
      wooOrderId: '731',
    });
    expect(findOne).toHaveBeenNthCalledWith(3, CheckoutOperation, {
      id: operation.id,
      subject: 'buyer-231',
    });
  });

  it('returns completed and missing checkout views @spec:AC-231', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-231',
      operationKey: 'operation-231',
      status: CheckoutOperationStatus.Completed,
      subject: 'buyer-231',
    });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(operation)
      .mockResolvedValueOnce(null);
    const service = new OrderWorkflowOperationsService(
      {} as CheckoutService,
      { findOne } as unknown as EntityManager,
    );

    await expect(
      service.findCheckout('buyer-231', operation.id),
    ).resolves.toMatchObject({ status: CheckoutOperationStatus.Completed });
    await expect(
      service.findCheckout('buyer-231', 'missing'),
    ).resolves.toBeNull();
  });

  it('rejects an invalid WooCommerce order identifier @spec:AC-231', async () => {
    const service = new OrderWorkflowOperationsService(
      {
        checkout: vi.fn().mockResolvedValue({ wooOrderId: '0' }),
      } as unknown as CheckoutService,
      {
        findOneOrFail: vi.fn().mockResolvedValue(new OrderWorkflow()),
      } as unknown as EntityManager,
    );

    await expect(
      service.checkout('buyer-231', {
        operationKey: 'operation-231',
        payerEmail: 'buyer@example.test',
        paymentMethod: 'CARD',
        paymentMethodId: 'visa',
        providerToken: 'provider-token',
      }),
    ).rejects.toThrow('Woo order id must be a positive decimal integer');
  });
});
