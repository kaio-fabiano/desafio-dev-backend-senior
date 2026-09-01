import { setTimeout as delay } from 'node:timers/promises';

import {
  checkoutCommandHash,
  checkoutWooReference,
  type CheckoutCommandData,
} from './command-hash.ts';
import type { CheckoutRepository } from './checkout.repository.ts';
import type { WooOrderPort } from './woo-order.port.ts';
import type { OutboxRepository } from '../outbox/outbox.repository.ts';

export interface CheckoutCommand extends CheckoutCommandData {
  subject: string;
  operationKey: string;
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

export class CheckoutService {
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly outbox: OutboxRepository,
    private readonly wooOrders: WooOrderPort,
  ) {}

  async checkout(command: CheckoutCommand): Promise<CheckoutResult> {
    this.validate(command);
    const items = cartItems(command.cartSnapshot);
    const amount = cartAmount(command.cartSnapshot);
    const currency = cartCurrency(command.cartSnapshot);
    const commandHash = checkoutCommandHash({
      paymentMethod: command.paymentMethod,
      cartSnapshot: command.cartSnapshot,
    });
    const wooReference = checkoutWooReference(
      command.subject,
      command.operationKey,
    );
    const { operation, created } = await this.checkouts.claim({
      subject: command.subject,
      operationKey: command.operationKey,
      commandHash,
      wooReference,
    });

    if (operation.commandHash !== commandHash) {
      throw new CheckoutIdempotencyConflictError(
        'The operation key is already bound to a different checkout command',
      );
    }
    if (operation.wooOrderId) {
      return { operationId: operation.id, wooOrderId: operation.wooOrderId };
    }
    if (!created) {
      const confirmed = await this.waitForConfirmation(command);
      if (confirmed?.wooOrderId) {
        return {
          operationId: confirmed.id,
          wooOrderId: confirmed.wooOrderId,
        };
      }
    }

    const order = await this.wooOrders.createOrFind({
      subject: command.subject,
      paymentMethod: command.paymentMethod,
      cartSnapshot: command.cartSnapshot,
      reference: operation.wooReference,
    });
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

  private async waitForConfirmation(command: CheckoutCommand) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await delay(50);
      const operation = await this.checkouts.find(
        command.subject,
        command.operationKey,
      );
      if (operation?.wooOrderId) return operation;
    }
    return null;
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
