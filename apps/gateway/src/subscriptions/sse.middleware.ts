import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthContextFactory } from '@desafio-dev-backend-senior/source/gateway-nest';
import { OrderWorkflowSubscriptionClient } from './order-workflow-subscription.client.ts';
import { GatewaySseHandler } from './sse-handler.ts';

@Injectable()
export class GatewaySseMiddleware implements NestMiddleware {
  private readonly handler: GatewaySseHandler;

  constructor(
    @Inject(AuthContextFactory)
    private readonly authContext: AuthContextFactory,
  ) {
    this.handler = new GatewaySseHandler({
      orderWorkflow: new OrderWorkflowSubscriptionClient(process.env.ORDER_WORKFLOW_SUBSCRIPTION_URL ?? 'http://order-workflow-subgraph:3003/graphql/stream'),
      verify: (request) => this.authContext.create(request),
    });
  }

  use(request: Request, response: Response) {
    return this.handler.handle(request, response);
  }
}
