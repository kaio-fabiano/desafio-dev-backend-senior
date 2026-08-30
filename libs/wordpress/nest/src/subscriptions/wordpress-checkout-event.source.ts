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
  marketplaceOrderDatabaseId?: unknown;
  order?: { id?: unknown; databaseId?: unknown; status?: unknown };
  paymentState?: unknown;
  pixCode?: unknown;
};

type CheckoutResponse = {
  data?: {
    checkout?: ObservedMutationResult;
    updateOrder?: ObservedMutationResult;
    recordCardPaymentV1?: ObservedMutationResult;
    recordPixPaymentV1?: ObservedMutationResult;
  };
};

/** Publishes only the checkout transition owned by WordPress/WooCommerce. */
export class WordPressCheckoutEventSource {
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
      text(result?.order?.id) ||
      integerText(result?.order?.databaseId) ||
      integerText(result?.marketplaceOrderDatabaseId);
    if (!operationKey || !orderId) return;

    const state =
      rootField === 'recordPixPaymentV1' || rootField === 'recordCardPaymentV1'
        ? text(result?.paymentState)
        : text(result?.order?.status);
    if (!state) return;

    this.events.publish({
      subject,
      operationKey,
      payload: {
        operationKey,
        orderId,
        state,
        ...(rootField === 'recordPixPaymentV1'
          ? { pixCode: text(result?.pixCode) }
          : {}),
        eventTime: new Date().toISOString(),
      },
    });
  }
}

Inject(OrderEventService)(WordPressCheckoutEventSource, undefined, 0);
Injectable()(WordPressCheckoutEventSource);

function mutationRootField(
  source: string,
):
  | 'checkout'
  | 'updateOrder'
  | 'recordCardPaymentV1'
  | 'recordPixPaymentV1'
  | undefined {
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
          [
            'checkout',
            'updateOrder',
            'recordCardPaymentV1',
            'recordPixPaymentV1',
          ].includes(
            selection.name.value,
          )
        )
          return selection.name.value as
            | 'checkout'
            | 'updateOrder'
            | 'recordCardPaymentV1'
            | 'recordPixPaymentV1';
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
