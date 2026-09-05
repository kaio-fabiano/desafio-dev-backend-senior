import { describe, expect, it } from 'vitest';

import { MessagingModule } from './messaging.module.ts';
import { OrderWorkflowRuntimeLifecycle } from './order-workflow-messaging.runtime.ts';

describe('MessagingModule', () => {
  it('owns and exports the RabbitMQ runtime lifecycle', () => {
    const providers = Reflect.getMetadata(
      'providers',
      MessagingModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      'exports',
      MessagingModule,
    ) as unknown[];

    expect(providers).toContain(OrderWorkflowRuntimeLifecycle);
    expect(exports).toContain(OrderWorkflowRuntimeLifecycle);
  });
});
