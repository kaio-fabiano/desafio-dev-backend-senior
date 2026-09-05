import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OrderWorkflowGraphqlModule } from './graphql/order-workflow-graphql.module.ts';
import { HealthController } from './health.controller.ts';
import { MessagingModule } from './messaging/messaging.module.ts';
import { OrderEventsModule } from './order-events/order-events.module.ts';
import { PersistenceModule } from './persistence/persistence.module.ts';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    PersistenceModule,
    OrderEventsModule,
    MessagingModule,
    OrderWorkflowGraphqlModule,
  ],
})
export class AppModule {}
