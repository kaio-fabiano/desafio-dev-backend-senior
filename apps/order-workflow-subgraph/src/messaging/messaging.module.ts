import { Module } from '@nestjs/common';

import { PersistenceModule } from '../persistence/persistence.module.ts';
import { OrderWorkflowRuntimeLifecycle } from './order-workflow-messaging.runtime.ts';

@Module({
  imports: [PersistenceModule],
  providers: [OrderWorkflowRuntimeLifecycle],
  exports: [OrderWorkflowRuntimeLifecycle],
})
export class MessagingModule {}
