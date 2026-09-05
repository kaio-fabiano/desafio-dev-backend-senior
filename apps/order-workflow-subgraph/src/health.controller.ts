import type { MikroORM } from '@mikro-orm/core';
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { OrderWorkflowRuntimeLifecycle } from './messaging/order-workflow-messaging.runtime.ts';
import { PostgresOrderEventRelay } from './order-events/postgres/postgres-order-event.relay.ts';
import { ORDER_WORKFLOW_ORM } from './persistence/persistence.tokens.ts';

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
    const database = await this.orm.checkConnection();
    if (!database.ok) throw new ServiceUnavailableException();
    return { status: 'ready' };
  }
}
