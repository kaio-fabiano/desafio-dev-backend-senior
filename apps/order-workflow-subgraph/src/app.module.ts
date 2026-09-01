import { Module } from '@nestjs/common';

import { OrderWorkflowModule } from './graphql/order-workflow.module.ts';
import { HealthController } from './health.controller.ts';

@Module({
  controllers: [HealthController],
  imports: [OrderWorkflowModule],
})
export class AppModule {}
