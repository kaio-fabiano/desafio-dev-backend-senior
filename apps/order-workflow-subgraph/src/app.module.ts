import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OrderWorkflowModule } from './graphql/order-workflow.module.ts';
import { HealthController } from './health.controller.ts';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    OrderWorkflowModule,
  ],
})
export class AppModule {}
