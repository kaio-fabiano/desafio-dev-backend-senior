import { Module } from '@nestjs/common';

import { CommerceResolver } from './commerce.resolver.ts';
import { OrderEventBroker } from '../subscriptions/order-event-broker.ts';
import { OrderEventsSubscription } from '../subscriptions/order-events.subscription.ts';

export class CommerceModule {}

Module({
  providers: [CommerceResolver, OrderEventBroker, OrderEventsSubscription],
  exports: [OrderEventBroker, OrderEventsSubscription],
})(CommerceModule);
