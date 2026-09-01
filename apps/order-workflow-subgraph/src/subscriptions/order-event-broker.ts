export interface OrderEventPayload {
  operationKey: string;
  orderId: string;
  state: string;
  pixCode?: string;
  eventTime: string;
  version: number;
}

export interface RoutedOrderEvent {
  subject: string;
  operationKey: string;
  payload: OrderEventPayload;
}

export type OrderEventListener = (event: OrderEventPayload) => void;
export type OrderEventDisconnectListener = (error: Error) => void;

export class OrderEventBroker {
  private readonly listeners = new Map<string, Set<OrderEventListener>>();
  private readonly disconnectListeners =
    new Set<OrderEventDisconnectListener>();

  subscribe(
    subject: string,
    operationKey: string,
    listener: OrderEventListener,
    onDisconnect?: OrderEventDisconnectListener,
  ): () => void {
    const key = streamKey(subject, operationKey);
    const listeners = this.listeners.get(key) ?? new Set<OrderEventListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    if (onDisconnect) this.disconnectListeners.add(onDisconnect);
    return () => {
      listeners.delete(listener);
      if (onDisconnect) this.disconnectListeners.delete(onDisconnect);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  disconnect(error: Error): void {
    for (const listener of this.disconnectListeners) listener(error);
    this.listeners.clear();
    this.disconnectListeners.clear();
  }

  publish(event: RoutedOrderEvent): void {
    const key = streamKey(event.subject, event.operationKey);
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
