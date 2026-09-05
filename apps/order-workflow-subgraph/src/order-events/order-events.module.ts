import type { MikroORM } from '@mikro-orm/core';
import { Module } from '@nestjs/common';

import { PersistenceModule } from '../persistence/persistence.module.ts';
import { ORDER_WORKFLOW_ORM } from '../persistence/persistence.tokens.ts';
import { OrderEventBroker } from './order-event-broker.ts';
import { OrderEventsSubscription } from './order-events.subscription.ts';
import { MikroOrmOrderEventReplay } from './postgres/mikro-orm-order-event.replay.ts';
import { PostgresOrderEventRelay } from './postgres/postgres-order-event.relay.ts';

@Module({
  imports: [PersistenceModule],
  providers: [
    OrderEventBroker,
    {
      provide: MikroOrmOrderEventReplay,
      inject: [ORDER_WORKFLOW_ORM],
      useFactory: (orm: MikroORM) => new MikroOrmOrderEventReplay(orm),
    },
    {
      provide: PostgresOrderEventRelay,
      inject: [OrderEventBroker, MikroOrmOrderEventReplay],
      useFactory: (
        broker: OrderEventBroker,
        replay: MikroOrmOrderEventReplay,
      ) => new PostgresOrderEventRelay(broker, replay),
    },
    {
      provide: OrderEventsSubscription,
      inject: [OrderEventBroker, MikroOrmOrderEventReplay],
      useFactory: (
        broker: OrderEventBroker,
        replay: MikroOrmOrderEventReplay,
      ) => new OrderEventsSubscription(broker, replay),
    },
  ],
  exports: [OrderEventBroker, OrderEventsSubscription, PostgresOrderEventRelay],
})
export class OrderEventsModule {}
