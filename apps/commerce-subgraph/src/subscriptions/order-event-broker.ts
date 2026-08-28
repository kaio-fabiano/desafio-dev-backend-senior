export interface OrderEventPayload {
  operationKey: string;
  orderId: string;
  state: string;
  pixCode?: string;
  eventTime: string;
}

export interface RoutedOrderEvent {
  subject: string;
  operationKey: string;
  payload: OrderEventPayload;
}

export type OrderEventListener = (event: OrderEventPayload) => void;

export class OrderEventBroker {
  private readonly listeners = new Map<string, Set<OrderEventListener>>();
  private readonly latest = new Map<string, OrderEventPayload>();

  subscribe(
    subject: string,
    operationKey: string,
    listener: OrderEventListener,
  ): () => void {
    const key = streamKey(subject, operationKey);
    const listeners = this.listeners.get(key) ?? new Set<OrderEventListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    const latest = this.latest.get(key);
    if (latest) queueMicrotask(() => listener(latest));

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  publish(event: RoutedOrderEvent): void {
    const key = streamKey(event.subject, event.operationKey);
    this.latest.set(key, event.payload);
    if (this.latest.size > 1_000) {
      this.latest.delete(this.latest.keys().next().value!);
    }
    for (const listener of this.listeners.get(key) ?? []) {
      listener(event.payload);
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
}

function streamKey(subject: string, operationKey: string): string {
  return `${subject.length}:${subject}${operationKey}`;
}
