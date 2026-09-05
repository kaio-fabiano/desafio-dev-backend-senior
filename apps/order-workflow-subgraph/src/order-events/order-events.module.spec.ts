import { type InjectionToken, type Provider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { OrderEventBroker } from './order-event-broker.ts';
import { OrderEventsModule } from './order-events.module.ts';
import { OrderEventsSubscription } from './order-events.subscription.ts';
import { MikroOrmOrderEventReplay } from './postgres/mikro-orm-order-event.replay.ts';
import { PostgresOrderEventRelay } from './postgres/postgres-order-event.relay.ts';

describe('OrderEventsModule', () => {
  it('owns and exports the event stream providers', () => {
    const providers = Reflect.getMetadata('providers', OrderEventsModule) as Provider[];
    const exports = Reflect.getMetadata('exports', OrderEventsModule) as unknown[];
    const factory = (token: InjectionToken) => {
      const provider = providers.find(
        (candidate) =>
          typeof candidate === 'object' && candidate.provide === token,
      );
      if (!provider || !('useFactory' in provider)) {
        throw new Error(`Missing factory for ${String(token)}`);
      }
      return provider.useFactory;
    };
    const broker = new OrderEventBroker();
    const replay = factory(MikroOrmOrderEventReplay)({} as never);

    expect(replay).toBeInstanceOf(MikroOrmOrderEventReplay);
    expect(factory(PostgresOrderEventRelay)(broker, replay)).toBeInstanceOf(
      PostgresOrderEventRelay,
    );
    expect(factory(OrderEventsSubscription)(broker, replay)).toBeInstanceOf(
      OrderEventsSubscription,
    );
    expect(providers).toContain(OrderEventBroker);
    expect(exports).toEqual(
      expect.arrayContaining([
        OrderEventBroker,
        OrderEventsSubscription,
        PostgresOrderEventRelay,
      ]),
    );
  });
});
