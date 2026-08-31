import type { IncomingHttpHeaders } from 'node:http';

import { Inject, Injectable } from '@nestjs/common';
import { Kind, parse } from 'graphql';

import { OrderEventService } from './order-event.service.ts';

type CheckoutOperation = {
  query: string;
  variables?: Record<string, unknown>;
};

type ObservedMutationResult = {
  clientMutationId?: unknown;
  order?: {
    id?: unknown;
    databaseId?: unknown;
    status?: unknown;
    metaData?: Array<{ key?: unknown; value?: unknown }>;
  };
};

type CheckoutResponse = {
  data?: {
    checkout?: ObservedMutationResult;
    updateOrder?: ObservedMutationResult;
  };
};

/** Publishes only the checkout transition owned by WordPress/WooCommerce. */
export class WordPressCheckoutEventSource {
  private readonly pending = new Map<
    string,
    { subject: string; operationKey: string }
  >();

  constructor(private readonly events: OrderEventService) {}

  async observe(
    operation: CheckoutOperation,
    headers: IncomingHttpHeaders,
    response: Response,
  ): Promise<void> {
    const rootField = mutationRootField(operation.query);
    if (!rootField) return;
    const subject = header(headers, 'x-authenticated-subject');
    if (!subject || !response.ok || !isJson(response)) return;

    const payload = (await response
      .clone()
      .json()
      .catch(() => undefined)) as CheckoutResponse | undefined;
    const result = payload?.data?.[rootField];
    const operationKey = text(result?.clientMutationId);
    const orderId =
      integerText(result?.order?.databaseId) || text(result?.order?.id);
    if (!operationKey || !orderId) return;

    this.pending.set(orderId, { subject, operationKey });
  }

  ingest(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const order = payload as {
      id?: unknown;
      status?: unknown;
      meta_data?: Array<{ key?: unknown; value?: unknown }>;
    };
    const orderId = integerText(order.id);
    const route = this.pending.get(orderId);
    if (!route) return;
    const metadata = order.meta_data ?? [];
    const paymentState = metadata.find(
      (entry) => text(entry.key) === 'payment_state',
    )?.value;
    const state = text(paymentState) || text(order.status).toUpperCase();
    if (!state) return;
    const pixCode = text(
      metadata.find((entry) => text(entry.key) === 'pix_code')?.value,
    );
    this.events.publish({
      ...route,
      payload: {
        operationKey: route.operationKey,
        orderId,
        state,
        ...(pixCode ? { pixCode } : {}),
        eventTime: new Date().toISOString(),
      },
    });
    if (['COMPLETED', 'CANCELLED', 'PIX_GENERATED'].includes(state)) {
      this.pending.delete(orderId);
    }
  }
}

Inject(OrderEventService)(WordPressCheckoutEventSource, undefined, 0);
Injectable()(WordPressCheckoutEventSource);

function mutationRootField(
  source: string,
): 'checkout' | 'updateOrder' | undefined {
  try {
    for (const definition of parse(source).definitions) {
      if (
        definition.kind !== Kind.OPERATION_DEFINITION ||
        definition.operation !== 'mutation'
      )
        continue;
      for (const selection of definition.selectionSet.selections) {
        if (
          selection.kind === Kind.FIELD &&
          ['checkout', 'updateOrder'].includes(selection.name.value)
        )
          return selection.name.value as 'checkout' | 'updateOrder';
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function header(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function isJson(response: Response): boolean {
  return (
    response.headers.get('content-type')?.includes('application/json') ?? false
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integerText(value: unknown): string {
  return Number.isSafeInteger(value) ? String(value) : '';
}
