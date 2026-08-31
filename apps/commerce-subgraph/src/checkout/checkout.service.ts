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
    const commandHash = checkoutCommandHash({
      paymentMethod: command.paymentMethod,
      cartSnapshot: command.cartSnapshot,
    });
    const wooReference = checkoutWooReference(
      command.subject,
      command.operationKey,
    );
    const { operation } = await this.checkouts.claim({
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

    const order = await this.wooOrders.createOrFind({
      subject: command.subject,
      paymentMethod: command.paymentMethod,
      cartSnapshot: command.cartSnapshot,
      reference: operation.wooReference,
    });
    await this.checkouts.confirm(
      operation.id,
      order.id,
      cartItems(command.cartSnapshot),
      async (transaction, workflow) =>
        this.enqueueCheckoutRequested(
          transaction,
          workflow.id,
          operation.id,
          operation.operationKey,
          order.id,
          command,
        ),
      command.paymentMethod,
    );
    return { operationId: operation.id, wooOrderId: order.id };
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
  ): Promise<void> {
    return this.outbox.enqueueCheckoutRequested(transaction, workflowId, {
      checkoutId,
      operationKey,
      paymentId: `payment-${checkoutId}`,
      orderId,
      method: command.paymentMethod,
      amount: cartAmount(command.cartSnapshot),
      currency: cartCurrency(command.cartSnapshot),
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

function cartItems(snapshot: unknown): Array<{ productId: string; quantity: number }> {
  const items = snapshot && typeof snapshot === 'object'
    ? Reflect.get(snapshot, 'items')
    : undefined;
  if (!Array.isArray(items)) return [];
  return items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new CheckoutInputError('Cart item is invalid');
    const productId = Number(Reflect.get(item, 'id') ?? Reflect.get(item, 'productId'));
    const quantity = Number(Reflect.get(item, 'quantity'));
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1) {
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
  return Number.isFinite(total) ? total / 10 ** minorUnit : 0;
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
  return typeof currency === 'string' && currency ? currency : 'BRL';
}
