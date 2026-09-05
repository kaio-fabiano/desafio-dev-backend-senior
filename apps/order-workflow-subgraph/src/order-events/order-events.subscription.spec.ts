import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OrderEventBroker,
  type OrderEventPayload,
} from './order-event-broker.ts';
import {
  OrderEventBackpressureError,
  OrderEventsSubscription,
} from './order-events.subscription.ts';

describe('OrderEventsSubscription', () => {
  afterEach(() => vi.useRealTimers());

  it('orders replay behind newer live delivery and filters duplicates @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    let resolveReplay!: (event: OrderEventPayload) => void;
    const replay = new Promise<OrderEventPayload>((resolve) => {
      resolveReplay = resolve;
    });
    const stream = new OrderEventsSubscription(broker, {
      latest: () => replay,
    }).subscribe('buyer-231', 'operation-231');
    const live = event(2, 'PAYMENT_PENDING');
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'operation-231',
      payload: live,
    });
    resolveReplay(event(1, 'CREATED'));

    await expect(stream.next()).resolves.toEqual({ done: false, value: live });
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'operation-231',
      payload: live,
    });
    const pending = stream.next();
    const latest = event(3, 'STOCK_PENDING');
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'operation-231',
      payload: latest,
    });
    await expect(pending).resolves.toEqual({ done: false, value: latest });
    await stream.return?.();
    expect(broker.listenerCount()).toBe(0);
  });

  it('removes listeners and resolves pending reads on abort @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    const abort = new AbortController();
    const stream = subscription(broker).subscribe(
      'buyer-231',
      'operation-231',
      { signal: abort.signal },
    );
    const pending = stream.next();

    abort.abort();

    await expect(pending).resolves.toEqual({ done: true, value: undefined });
    expect(broker.listenerCount()).toBe(0);
  });

  it('propagates replay and broker failures after cleaning up @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    const replayFailure = new Error('replay unavailable');
    const replayStream = new OrderEventsSubscription(broker, {
      latest: async () => {
        throw replayFailure;
      },
    }).subscribe('buyer-231', 'replay-231');
    await expect(replayStream.next()).rejects.toBe(replayFailure);

    const nonErrorReplay = new OrderEventsSubscription(broker, {
      latest: async () => {
        throw 'unavailable';
      },
    }).subscribe('buyer-231', 'non-error-replay-231');
    await expect(nonErrorReplay.next()).rejects.toThrow('Order replay failed');

    const brokerStream = subscription(broker).subscribe(
      'buyer-231',
      'broker-231',
    );
    const pending = brokerStream.next();
    const brokerFailure = new Error('broker unavailable');
    broker.disconnect(brokerFailure);
    await expect(pending).rejects.toBe(brokerFailure);
    expect(broker.listenerCount()).toBe(0);
  });

  it('closes terminal streams and rejects overflowing consumers @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    const stream = subscription(broker, 1).subscribe(
      'buyer-231',
      'terminal-231',
    );
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'terminal-231',
      payload: event(1, 'COMPLETED'),
    });
    await expect(stream.next()).resolves.toMatchObject({ done: false });
    await expect(stream.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });

    const overflow = subscription(broker, 1).subscribe(
      'buyer-231',
      'overflow-231',
    );
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'overflow-231',
      payload: event(1, 'CREATED'),
    });
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'overflow-231',
      payload: event(2, 'PAYMENT_PENDING'),
    });
    await expect(overflow.next()).rejects.toBeInstanceOf(
      OrderEventBackpressureError,
    );
  });

  it('emits heartbeats and closes an idle stream @spec:AC-231', async () => {
    vi.useFakeTimers();
    const broker = new OrderEventBroker();
    const heartbeat = vi.fn();
    const stream = new OrderEventsSubscription(
      broker,
      { latest: async () => null },
      { heartbeatMs: 10, idleTimeoutMs: 25, maxBufferedEvents: 1 },
    ).subscribe('buyer-231', 'idle-231', { onHeartbeat: heartbeat });
    const pending = stream.next();

    await vi.advanceTimersByTimeAsync(25);

    expect(heartbeat).toHaveBeenCalledTimes(2);
    await expect(pending).resolves.toEqual({ done: true, value: undefined });
  });

  it('validates lifecycle limits and stream identifiers @spec:AC-231', () => {
    const broker = new OrderEventBroker();
    for (const options of [
      { heartbeatMs: 0, idleTimeoutMs: 1, maxBufferedEvents: 1 },
      { heartbeatMs: 1, idleTimeoutMs: 0, maxBufferedEvents: 1 },
      { heartbeatMs: 1, idleTimeoutMs: 1, maxBufferedEvents: 0 },
    ]) {
      expect(
        () => new OrderEventsSubscription(broker, undefined, options),
      ).toThrow(RangeError);
    }
    const subscriptions = new OrderEventsSubscription(broker);
    expect(() => subscriptions.subscribe(' ', 'operation-231')).toThrow(
      'subject must be a non-empty string',
    );
    expect(() => subscriptions.subscribe('buyer-231', '')).toThrow(
      'operationKey must be a non-empty string',
    );
  });

  it('supports an already-aborted default stream and explicit iterator failures @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    const abort = new AbortController();
    abort.abort();
    const stream = new OrderEventsSubscription(broker).subscribe(
      'buyer-231',
      'operation-231',
      { signal: abort.signal },
    );

    expect(stream[Symbol.asyncIterator]()).toBe(stream);
    await expect(stream.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });

    const failed = subscription(broker).subscribe('buyer-231', 'throw-231');
    await expect(failed.throw?.('bad consumer')).rejects.toThrow(
      'Subscription failed',
    );
    await expect(failed.next()).rejects.toThrow('Subscription failed');

    const explicitFailure = new Error('explicit consumer failure');
    const explicit = subscription(broker).subscribe(
      'buyer-231',
      'throw-error-231',
    );
    await expect(explicit.throw?.(explicitFailure)).rejects.toBe(
      explicitFailure,
    );
  });

  it('closes immediately after delivering a terminal event to a waiting consumer @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    const stream = subscription(broker).subscribe(
      'buyer-231',
      'terminal-waiting-231',
    );
    const pending = stream.next();
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'terminal-waiting-231',
      payload: event(1, 'PIX_GENERATED'),
    });

    await expect(pending).resolves.toMatchObject({ done: false });
    await expect(stream.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(broker.listenerCount()).toBe(0);
  });

  it('finishes every waiter on a terminal event and ignores a late replay @spec:AC-231', async () => {
    const broker = new OrderEventBroker();
    let resolveReplay!: (value: OrderEventPayload) => void;
    const replay = new Promise<OrderEventPayload>((resolve) => {
      resolveReplay = resolve;
    });
    const stream = new OrderEventsSubscription(broker, {
      latest: () => replay,
    }).subscribe('buyer-231', 'terminal-many-231');
    const first = stream.next();
    const second = stream.next();
    broker.publish({
      subject: 'buyer-231',
      operationKey: 'terminal-many-231',
      payload: event(2, 'COMPLETED'),
    });
    resolveReplay(event(1, 'CREATED'));

    await expect(first).resolves.toMatchObject({ done: false });
    await expect(second).resolves.toEqual({ done: true, value: undefined });
    await expect(stream.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});

function subscription(broker: OrderEventBroker, maxBufferedEvents = 4) {
  return new OrderEventsSubscription(
    broker,
    { latest: async () => null },
    { heartbeatMs: 60_000, idleTimeoutMs: 60_000, maxBufferedEvents },
  );
}

function event(version: number, state: string): OrderEventPayload {
  return {
    eventTime: new Date(version).toISOString(),
    operationKey: 'operation-231',
    orderId: '731',
    state,
    version,
  };
}
