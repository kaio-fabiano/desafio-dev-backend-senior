import type { MikroORM } from '@mikro-orm/core';
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ORDER_WORKFLOW_ORM } from './graphql/order-workflow.tokens.ts';
import { OrderWorkflowRuntimeLifecycle } from './messaging/order-workflow-messaging.runtime.ts';
import { PostgresOrderEventRelay } from './subscriptions/postgres-order-event.relay.ts';

@Controller()
export class HealthController {
  private initialized = false;

  constructor(
    @Inject(PostgresOrderEventRelay)
    private readonly orderEvents: PostgresOrderEventRelay,
    @Inject(OrderWorkflowRuntimeLifecycle)
    private readonly messaging: OrderWorkflowRuntimeLifecycle,
    @Inject(ORDER_WORKFLOW_ORM)
    private readonly orm: MikroORM,
  ) {}

  onApplicationBootstrap() {
    this.initialized = true;
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    if (
      !this.initialized ||
      !this.orderEvents.connected ||
      !this.messaging.connected
    ) {
      throw new ServiceUnavailableException();
    }
    await this.orm.em.fork().getConnection().execute('select 1');
    return { status: 'ready' };
  }
}
