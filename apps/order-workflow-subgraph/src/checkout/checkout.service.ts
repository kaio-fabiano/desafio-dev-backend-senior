import { setTimeout as delay } from 'node:timers/promises';

import {
  checkoutCommandHash,
  checkoutWooReference,
  type CheckoutCommandData,
} from './command-hash.ts';
import type { CheckoutRepository } from './checkout.repository.ts';
import type {
  WooCheckoutPort,
  WooCheckoutSession,
} from './woo-checkout.port.ts';
import type { OutboxRepository } from '../outbox/outbox.repository.ts';
import { CheckoutOperationStatus } from '../persistence/entities/checkout-operation.entity.ts';

export interface CheckoutCommand extends CheckoutCommandData {
  subject: string;
  operationKey: string;
  session?: WooCheckoutSession;
}

export interface CheckoutResult {
  operationId: string;
  wooOrderId: string;
}

export class CheckoutInputError extends Error {
  readonly code = 'CHECKOUT_INPUT_INVALID';
}

export class CheckoutIdempotencyConflictError extends Error {
  readonly code = 'CHECKOUT_IDEMPOTENCY_CONFLICT';
}

export class CheckoutReconciliationPendingError extends Error {
  readonly code = 'CHECKOUT_RECONCILIATION_PENDING';
}

export class CheckoutService {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly outbox: OutboxRepository,
    private readonly wooCheckout: WooCheckoutPort,
  ) {}

  async checkout(command: CheckoutCommand): Promise<CheckoutResult> {
    this.validate(command);
    const commandHash = checkoutCommandHash(command);
    const wooReference = checkoutWooReference(
      command.subject,
      command.operationKey,
    );
    let claim;
    for (;;) {
      claim = await this.checkouts.claim({
        subject: command.subject,
        operationKey: command.operationKey,
        commandHash,
        wooReference,
      });
      if (
        claim.operation.subject !== command.subject ||
        claim.operation.commandHash !== commandHash
      ) {
        throw new CheckoutIdempotencyConflictError(
          'The operation key is already bound to a different checkout command',
        );
      }
      if (claim.operation.wooOrderId) {
        return {
          operationId: claim.operation.id,
          wooOrderId: claim.operation.wooOrderId,
        };
      }
      if (claim.ownerToken) break;
      await delay(50);
    }

    const { operation } = claim;
    const ownerToken = claim.ownerToken;
    if (!ownerToken)
      throw new Error('Checkout creation lease was not acquired');
    let order;
    try {
      if (operation.status === CheckoutOperationStatus.PendingWoo) {
        await this.checkouts.beginCreation(operation.id, ownerToken);
        order = await this.wooCheckout.createOrFind({
          subject: command.subject,
          paymentMethod: command.paymentMethod,
          reference: operation.wooReference,
          session: command.session,
        });
      } else {
        order = await this.wooCheckout.findByReference({
          subject: command.subject,
          paymentMethod: command.paymentMethod,
          reference: operation.wooReference,
          session: command.session,
        });
        if (!order) {
          throw new CheckoutReconciliationPendingError(
            'WooOrderWorkflow order creation is still being reconciled',
          );
        }
      }
    } catch (error) {
      await this.checkouts.release(operation.id, ownerToken);
      throw error;
    }
    const items = cartItems(order.cartSnapshot);
    const amount = cartAmount(order.cartSnapshot);
    const currency = cartCurrency(order.cartSnapshot);
    const workflow = await this.checkouts.confirm(
      operation.id,
      order.id,
      items,
      async (transaction, workflow) =>
        this.enqueueCheckoutRequested(
          transaction,
          workflow.id,
          operation.id,
          operation.operationKey,
          order.id,
          command,
          amount,
          currency,
        ),
      command.paymentMethod,
    );
    return { operationId: operation.id, wooOrderId: workflow.wooOrderId };
  }

  reconcile(command: CheckoutCommand): Promise<CheckoutResult> {
    return this.checkout(command);
  }

  private enqueueCheckoutRequested(
    transaction: unknown,
    workflowId: string,
    checkoutId: string,
    operationKey: string,
    orderId: string,
    command: CheckoutCommand,
    amount: number,
    currency: string,
  ): Promise<void> {
    return this.outbox.enqueueCheckoutRequested(transaction, workflowId, {
      checkoutId,
      operationKey,
      paymentId: `payment-${checkoutId}`,
      orderId,
      method: command.paymentMethod,
      amount,
      currency,
    });
  }

  private validate(command: CheckoutCommand): void {
    for (const value of [
      command.subject,
      command.operationKey,
      command.paymentMethod,
    ]) {
      if (!value.trim())
        throw new CheckoutInputError('Checkout fields are required');
    }
  }
}

function cartItems(
  snapshot: unknown,
): Array<{ productId: string; quantity: number }> {
  const items =
    snapshot && typeof snapshot === 'object'
      ? Reflect.get(snapshot, 'items')
      : undefined;
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutInputError('Cart must contain at least one item');
  }
  return items.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new CheckoutInputError('Cart item is invalid');
    const productId = Number(
      Reflect.get(item, 'id') ?? Reflect.get(item, 'productId'),
    );
    const quantity = Number(Reflect.get(item, 'quantity'));
    if (
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      throw new CheckoutInputError('Cart item is invalid');
    }
    return { productId: String(productId), quantity };
  });
}

function cartAmount(snapshot: unknown): number {
  const totals =
    snapshot && typeof snapshot === 'object'
      ? Reflect.get(snapshot, 'totals')
      : undefined;
  const total =
    totals && typeof totals === 'object'
      ? Number(Reflect.get(totals, 'total_price'))
      : Number.NaN;
  const minorUnit =
    totals && typeof totals === 'object'
      ? Number(Reflect.get(totals, 'currency_minor_unit'))
      : 2;
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    !Number.isSafeInteger(minorUnit) ||
    minorUnit < 0 ||
    minorUnit > 6
  ) {
    throw new CheckoutInputError('Cart total is invalid');
  }
  return total / 10 ** minorUnit;
}

function cartCurrency(snapshot: unknown): string {
  const totals =
    snapshot && typeof snapshot === 'object'
      ? Reflect.get(snapshot, 'totals')
      : undefined;
  const currency =
    totals && typeof totals === 'object'
      ? Reflect.get(totals, 'currency_code')
      : undefined;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw new CheckoutInputError('Cart currency is invalid');
  }
  return currency;
}
