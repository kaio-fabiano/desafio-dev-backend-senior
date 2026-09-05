import { describe, expect, it, vi } from 'vitest';

import type { OutboxRepository } from '../outbox/outbox.repository.ts';
import {
  CheckoutOperation,
  CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import {
  CheckoutIdempotencyConflictError,
  CheckoutInputError,
  CheckoutReconciliationPendingError,
  CheckoutService,
  type CheckoutCommand,
} from './checkout.service.ts';
import type { CheckoutRepository } from './checkout.repository.ts';
import type { WooCheckoutPort } from './woo-checkout.port.ts';

const command: CheckoutCommand = {
  subject: 'buyer-1',
  operationKey: 'operation-1',
  paymentMethod: 'CARD',
  payerEmail: 'buyer@example.test',
  providerToken: 'provider-token',
  paymentMethodId: 'visa',
};

const wooOrder = {
  id: 'woo-1',
  cartSnapshot: {
    items: [{ id: 1001, quantity: 2 }],
    totals: {
      total_price: '1990',
      currency_minor_unit: 2,
      currency_code: 'BRL',
    },
  },
};

describe('CheckoutService', () => {
  it.each([
    { ...command, subject: ' ' },
    { ...command, operationKey: '' },
    { ...command, paymentMethod: 1 as never },
    { ...command, payerEmail: '' },
    { ...command, providerToken: undefined },
    { ...command, paymentMethodId: undefined },
    { ...command, providerToken: 1 as never },
    { ...command, paymentMethodId: 1 as never },
    { ...command, paymentMethod: 'PIX' as const, providerToken: 'token' },
    { ...command, paymentMethod: 'PIX' as const, paymentMethodId: 'pix' },
  ])(
    'rejects an invalid command before claiming it %# @spec:AC-229',
    async (invalid) => {
      const claim = vi.fn<CheckoutRepository['claim']>();
      const service = new CheckoutService(
        checkoutRepository({ claim }),
        {} as OutboxRepository,
        {} as WooCheckoutPort,
      );

      await expect(service.checkout(invalid)).rejects.toBeInstanceOf(
        CheckoutInputError,
      );
      expect(claim).not.toHaveBeenCalled();
    },
  );

  it('rejects unsupported payment methods before persistence or WooCommerce @spec:AC-229', async () => {
    const claim = vi.fn<CheckoutRepository['claim']>();
    const createOrFind = vi.fn<WooCheckoutPort['createOrFind']>();
    const service = new CheckoutService(
      checkoutRepository({ claim }),
      {} as OutboxRepository,
      wooCheckoutPort({ createOrFind }),
    );
    const invalidCommand = {
      subject: 'buyer-1',
      operationKey: 'operation-1',
      paymentMethod: 'CASH',
      payerEmail: 'buyer@example.test',
    } as unknown as CheckoutCommand;

    await expect(service.checkout(invalidCommand)).rejects.toBeInstanceOf(
      CheckoutInputError,
    );
    expect(claim).not.toHaveBeenCalled();
    expect(createOrFind).not.toHaveBeenCalled();
  });

  it('rejects an operation key bound to another subject or command @spec:AC-229', async () => {
    const service = new CheckoutService(
      checkoutRepository({
        async claim() {
          return {
            operation: Object.assign(new CheckoutOperation(), {
              id: 'checkout-1',
              subject: 'another-buyer',
              operationKey: command.operationKey,
              commandHash: 'different-command',
              wooReference: 'reference-1',
            }),
            ownerToken: null,
          };
        },
      }),
      {} as OutboxRepository,
      {} as WooCheckoutPort,
    );

    await expect(service.checkout(command)).rejects.toBeInstanceOf(
      CheckoutIdempotencyConflictError,
    );
  });

  it('waits for an active owner and returns its completed operation @spec:AC-229', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference: 'reference-1',
      status: CheckoutOperationStatus.CreatingWoo,
    });
    let claims = 0;
    const service = new CheckoutService(
      checkoutRepository({
        async claim() {
          claims += 1;
          if (claims === 1) return { operation, ownerToken: null };
          operation.wooOrderId = 'woo-1';
          operation.status = CheckoutOperationStatus.Completed;
          return { operation, ownerToken: null };
        },
      }),
      {} as OutboxRepository,
      {} as WooCheckoutPort,
    );

    await expect(service.checkout(command)).resolves.toEqual({
      operationId: operation.id,
      wooOrderId: 'woo-1',
    });
    expect(claims).toBe(2);
  });

  it('fails closed when a claimed checkout loses its creation lease @spec:AC-229', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference: 'reference-1',
      status: CheckoutOperationStatus.PendingWoo,
    });
    let reads = 0;
    const claim = {
      operation,
      get ownerToken() {
        reads += 1;
        return reads === 1 ? 'owner-1' : undefined;
      },
    };
    const service = new CheckoutService(
      { claim: vi.fn(async () => claim) } as unknown as CheckoutRepository,
      {} as OutboxRepository,
      {} as WooCheckoutPort,
    );

    await expect(service.checkout(command)).rejects.toThrow(
      'Checkout creation lease was not acquired',
    );
  });

  it('releases its lease when WooCommerce cannot be reached @spec:AC-229', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference: 'reference-1',
      status: CheckoutOperationStatus.PendingWoo,
    });
    const release = vi.fn<CheckoutRepository['release']>(async () => undefined);
    const service = new CheckoutService(
      {
        async claim() {
          return { operation, ownerToken: 'owner-1' };
        },
        beginCreation: vi.fn(async () => undefined),
        release,
      } as unknown as CheckoutRepository,
      {} as OutboxRepository,
      {
        createOrFind: vi.fn(async () => {
          throw new Error('WooCommerce unavailable');
        }),
      } as unknown as WooCheckoutPort,
    );

    await expect(service.checkout(command)).rejects.toThrow(
      'WooCommerce unavailable',
    );
    expect(release).toHaveBeenCalledWith(operation.id, 'owner-1');
  });

  it('keeps a creating operation pending when reconciliation finds no order @spec:AC-229', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference: 'reference-1',
      status: CheckoutOperationStatus.CreatingWoo,
    });
    const release = vi.fn<CheckoutRepository['release']>(async () => undefined);
    const service = new CheckoutService(
      {
        async claim() {
          return { operation, ownerToken: 'owner-2' };
        },
        release,
      } as unknown as CheckoutRepository,
      {} as OutboxRepository,
      {
        findByReference: vi.fn(async () => null),
      } as unknown as WooCheckoutPort,
    );

    await expect(service.reconcile(command)).rejects.toBeInstanceOf(
      CheckoutReconciliationPendingError,
    );
    expect(release).toHaveBeenCalledWith(operation.id, 'owner-2');
  });

  it.each([
    null,
    {},
    { items: [], totals: {} },
    { items: [null], totals: {} },
    {
      items: [{ id: 0, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 0 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ productId: 1001, quantity: 1 }],
    },
    {
      items: [{ productId: 1001, quantity: 1 }],
      totals: null,
    },
    {
      items: [{ productId: 1001, quantity: 1 }],
      totals: {
        total_price: 'not-an-integer',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '0',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: -1,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 1.5,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 7,
        currency_code: 'BRL',
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 2,
      },
    },
    {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 2,
        currency_code: 'brl',
      },
    },
  ])('rejects an invalid cart snapshot %# @spec:AC-229', async (snapshot) => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference: 'reference-1',
      status: CheckoutOperationStatus.PendingWoo,
    });
    const confirm = vi.fn<CheckoutRepository['confirm']>();
    const service = new CheckoutService(
      {
        async claim() {
          return { operation, ownerToken: 'owner-1' };
        },
        beginCreation: vi.fn(async () => undefined),
        confirm,
      } as unknown as CheckoutRepository,
      {} as OutboxRepository,
      {
        createOrFind: vi.fn(async () => ({
          id: 'woo-1',
          cartSnapshot: snapshot,
        })),
      } as unknown as WooCheckoutPort,
    );

    await expect(service.checkout(command)).rejects.toBeInstanceOf(
      CheckoutInputError,
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reconciles a remote success after the original owner loses its lease @spec:AC-229', async () => {
    const operation = Object.assign(new CheckoutOperation(), {
      id: 'checkout-1',
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash:
        '1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0',
      wooReference:
        'order-workflow-55481d1f7ae76f7a8f235a304f5980deaa321a9c3d42d73430ccb34df8ac15f8',
      status: CheckoutOperationStatus.PendingWoo,
      ownerToken: undefined as string | undefined,
      wooOrderId: undefined as string | undefined,
    });
    let ownerSequence = 0;
    let createCount = 0;
    let findCount = 0;
    const repository = {
      async claim() {
        if (operation.wooOrderId) return { operation, ownerToken: null };
        const ownerToken = operation.ownerToken
          ? null
          : `owner-${++ownerSequence}`;
        if (ownerToken) operation.ownerToken = ownerToken;
        return { operation, ownerToken };
      },
      async beginCreation() {
        operation.status = CheckoutOperationStatus.CreatingWoo;
      },
      async release(_id: string, ownerToken: string) {
        if (operation.ownerToken === ownerToken) {
          operation.ownerToken = undefined;
        }
      },
      async confirm(
        _id: string,
        wooOrderId: string,
        _items: readonly { productId: string; quantity: number }[],
        onConfirmed: Parameters<CheckoutRepository['confirm']>[3],
        _paymentMethod: Parameters<CheckoutRepository['confirm']>[4],
        ownerToken: string,
      ) {
        if (operation.ownerToken !== ownerToken) {
          throw new Error('Checkout creation lease was lost');
        }
        const workflow = Object.assign(new OrderWorkflow(), {
          id: 'workflow-1',
          checkoutOperationId: operation.id,
          wooOrderId,
          stockItems: [],
        });
        await onConfirmed({}, workflow);
        operation.wooOrderId = wooOrderId;
        operation.ownerToken = undefined;
        operation.status = CheckoutOperationStatus.Completed;
        return workflow;
      },
    } satisfies CheckoutRepository;
    const outbox = {
      enqueueCheckoutRequested: vi.fn(async () => undefined),
    } satisfies OutboxRepository;
    const woo = {
      async createOrFind() {
        createCount += 1;
        operation.ownerToken = undefined;
        return wooOrder;
      },
      async findByReference() {
        findCount += 1;
        return wooOrder;
      },
    } satisfies WooCheckoutPort;
    const service = new CheckoutService(repository, outbox, woo);

    await expect(service.checkout(command)).rejects.toThrow(/lease was lost/);
    await expect(service.checkout(command)).resolves.toEqual({
      operationId: operation.id,
      wooOrderId: wooOrder.id,
    });
    await expect(service.checkout(command)).resolves.toEqual({
      operationId: operation.id,
      wooOrderId: wooOrder.id,
    });
    expect(createCount).toBe(1);
    expect(findCount).toBe(1);
    expect(outbox.enqueueCheckoutRequested).toHaveBeenCalledTimes(1);
  });
});

function checkoutRepository(
  overrides: Partial<CheckoutRepository>,
): CheckoutRepository {
  return {
    beginCreation: vi.fn<CheckoutRepository['beginCreation']>(),
    claim: vi.fn<CheckoutRepository['claim']>(),
    confirm: vi.fn<CheckoutRepository['confirm']>(),
    release: vi.fn<CheckoutRepository['release']>(),
    ...overrides,
  };
}

function wooCheckoutPort(overrides: Partial<WooCheckoutPort>): WooCheckoutPort {
  return {
    createOrFind: vi.fn<WooCheckoutPort['createOrFind']>(),
    findByReference: vi.fn<WooCheckoutPort['findByReference']>(),
    ...overrides,
  };
}
