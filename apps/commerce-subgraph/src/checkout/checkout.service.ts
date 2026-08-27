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
      async (transaction, workflow) =>
        this.enqueueCheckoutRequested(transaction, workflow.id, operation.id),
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
  ): Promise<void> {
    return this.outbox.enqueueCheckoutRequested(transaction, workflowId, {
      checkoutId,
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
