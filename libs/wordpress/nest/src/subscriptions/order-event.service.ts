import { Injectable, type OnApplicationShutdown } from '@nestjs/common';

const TERMINAL_STATES = new Set(['COMPLETED', 'CANCELLED', 'PIX_GENERATED']);

export type OrderEvent = {
  operationKey: string;
  orderId: string;
  state: string;
  pixCode?: string;
  eventTime: string;
};

export type RoutedOrderEvent = {
  subject: string;
  operationKey: string;
  payload: OrderEvent;
};

type StreamState = {
  accepting: boolean;
  closed: boolean;
  queue: OrderEvent[];
  waiting: Array<(result: IteratorResult<OrderEvent>) => void>;
  detach(): void;
  close(): void;
  receive(event: OrderEvent): void;
};

export class OrderEventService implements OnApplicationShutdown {
  private readonly listeners = new Map<string, Set<StreamState>>();
  private readonly streams = new Set<StreamState>();

  subscribe(
    subject: string,
    operationKey: string,
    signal?: AbortSignal,
  ): AsyncIterableIterator<OrderEvent> {
    requireIdentifier(subject, 'subject');
    requireIdentifier(operationKey, 'operationKey');

    const key = streamKey(subject, operationKey);
    const listeners = this.listeners.get(key) ?? new Set<StreamState>();
    const state: StreamState = {
      accepting: true,
      closed: false,
      queue: [],
      waiting: [],
      detach: () => {
        listeners.delete(state);
        if (listeners.size === 0) this.listeners.delete(key);
      },
      close: () => {
        if (state.closed) return;
        state.closed = true;
        state.accepting = false;
        state.queue.length = 0;
        state.detach();
        signal?.removeEventListener('abort', state.close);
        for (const resolve of state.waiting.splice(0)) {
          resolve({ done: true, value: undefined });
        }
        this.streams.delete(state);
      },
      receive: (event) => {
        if (!state.accepting) return;
        const resolve = state.waiting.shift();
        if (resolve) resolve({ done: false, value: event });
        else state.queue.push(event);
        if (TERMINAL_STATES.has(event.state)) {
          state.accepting = false;
          state.detach();
          signal?.removeEventListener('abort', state.close);
          for (const finish of state.waiting.splice(0)) {
            finish({ done: true, value: undefined });
          }
          if (state.queue.length === 0) this.streams.delete(state);
        }
      },
    };

    listeners.add(state);
    this.listeners.set(key, listeners);
    this.streams.add(state);
    signal?.addEventListener('abort', state.close, { once: true });
    if (signal?.aborted) state.close();

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: () => {
        const queued = state.queue.shift();
        if (queued) return Promise.resolve({ done: false, value: queued });
        if (state.closed || !state.accepting) {
          state.close();
          return Promise.resolve({ done: true, value: undefined });
        }
        return new Promise<IteratorResult<OrderEvent>>((resolve) =>
          state.waiting.push(resolve),
        );
      },
      return: () => {
        state.close();
        return Promise.resolve({ done: true, value: undefined });
      },
      throw: (error?: unknown) => {
        state.close();
        return Promise.reject(
          error instanceof Error ? error : new Error('Subscription failed'),
        );
      },
    };
  }

  publish(event: RoutedOrderEvent): void {
    requireIdentifier(event.subject, 'subject');
    requireIdentifier(event.operationKey, 'operationKey');
    for (const listener of this.listeners.get(
      streamKey(event.subject, event.operationKey),
    ) ?? []) {
      listener.receive(event.payload);
    }
  }

  listenerCount(subject?: string, operationKey?: string): number {
    if (subject !== undefined && operationKey !== undefined) {
      return this.listeners.get(streamKey(subject, operationKey))?.size ?? 0;
    }
    let count = 0;
    for (const listeners of this.listeners.values()) count += listeners.size;
    return count;
  }

  onApplicationShutdown(): void {
    for (const stream of [...this.streams]) stream.close();
  }
}

Injectable()(OrderEventService);

function requireIdentifier(value: string, field: string): void {
  if (!value.trim()) throw new TypeError(`${field} must be a non-empty string`);
}

function streamKey(subject: string, operationKey: string): string {
  return `${subject.length}:${subject}${operationKey}`;
}
