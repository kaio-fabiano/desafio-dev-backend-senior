import {
  type OrderEventBroker,
  type OrderEventPayload,
} from './order-event-broker.ts';

const TERMINAL_STATES = new Set(['COMPLETED', 'CANCELLED', 'PIX_GENERATED']);

export interface OrderEventsSubscriptionOptions {
  heartbeatMs: number;
  idleTimeoutMs: number;
  maxBufferedEvents: number;
}

export interface OrderEventsStreamOptions {
  onHeartbeat?: () => void;
  signal?: AbortSignal;
}

export class OrderEventBackpressureError extends Error {
  constructor() {
    super('Order event subscription buffer limit exceeded');
    this.name = 'OrderEventBackpressureError';
  }
}

export class OrderEventsSubscription {
  constructor(
    private readonly broker: OrderEventBroker,
    private readonly options: OrderEventsSubscriptionOptions = {
      heartbeatMs: 15_000,
      idleTimeoutMs: 60_000,
      maxBufferedEvents: 32,
    },
  ) {
    if (
      options.heartbeatMs <= 0 ||
      options.idleTimeoutMs <= 0 ||
      options.maxBufferedEvents <= 0
    ) {
      throw new RangeError('Subscription lifecycle limits must be positive');
    }
  }

  subscribe(
    subject: string,
    operationKey: string,
    streamOptions: OrderEventsStreamOptions = {},
  ): AsyncIterableIterator<OrderEventPayload> {
    requireIdentifier(subject, 'subject');
    requireIdentifier(operationKey, 'operationKey');

    const queue: OrderEventPayload[] = [];
    const waiting: Array<{
      reject: (error: Error) => void;
      resolve: (result: IteratorResult<OrderEventPayload>) => void;
    }> = [];
    let closed = false;
    let producerDone = false;
    let failure: Error | undefined;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(idleTimeout);
      unsubscribe();
      streamOptions.signal?.removeEventListener('abort', close);
    };
    const finishWaiting = () => {
      while (waiting.length > 0) {
        const waiter = waiting.shift();
        if (failure) waiter?.reject(failure);
        else waiter?.resolve({ done: true, value: undefined });
      }
    };
    const close = () => {
      cleanup();
      finishWaiting();
    };
    const fail = (error: Error) => {
      failure = error;
      queue.length = 0;
      close();
    };
    const receive = (event: OrderEventPayload) => {
      if (closed || producerDone) return;
      const waiter = waiting.shift();
      if (waiter) waiter.resolve({ done: false, value: event });
      else if (queue.length >= this.options.maxBufferedEvents) {
        fail(new OrderEventBackpressureError());
        return;
      } else queue.push(event);

      if (TERMINAL_STATES.has(event.state)) {
        producerDone = true;
        unsubscribe();
        if (queue.length === 0 && waiting.length > 0) close();
      }
    };

    const unsubscribe = this.broker.subscribe(subject, operationKey, receive);
    const heartbeat = setInterval(
      () => streamOptions.onHeartbeat?.(),
      this.options.heartbeatMs,
    );
    const idleTimeout = setTimeout(close, this.options.idleTimeoutMs);
    streamOptions.signal?.addEventListener('abort', close, { once: true });
    if (streamOptions.signal?.aborted) close();

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: () => {
        if (failure) return Promise.reject(failure);
        const event = queue.shift();
        if (event) {
          if (producerDone && queue.length === 0) cleanup();
          return Promise.resolve({ done: false, value: event });
        }
        if (closed || producerDone) {
          cleanup();
          return Promise.resolve({ done: true, value: undefined });
        }
        return new Promise<IteratorResult<OrderEventPayload>>(
          (resolve, reject) => waiting.push({ reject, resolve }),
        );
      },
      return: () => {
        close();
        return Promise.resolve({ done: true, value: undefined });
      },
      throw: (error?: unknown) => {
        const streamError =
          error instanceof Error ? error : new Error('Subscription failed');
        fail(streamError);
        return Promise.reject(streamError);
      },
    };
  }
}

function requireIdentifier(value: string, field: string): void {
  if (!value.trim()) throw new TypeError(`${field} must be a non-empty string`);
}
