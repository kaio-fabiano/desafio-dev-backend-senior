import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthContextFactory } from '@desafio-dev-backend-senior/source/gateway-nest';
import { createOrderWorkflowSubscriptionClient } from './order-workflow-subscription.client.ts';
import { createGatewaySseHandler } from './sse-handler.ts';

@Injectable()
export class GatewaySseMiddleware implements NestMiddleware {
  private readonly handle = createGatewaySseHandler({
    orderWorkflow: createOrderWorkflowSubscriptionClient({
      url:
        process.env.ORDER_WORKFLOW_SUBSCRIPTION_URL ??
        'http://order-workflow-subgraph:3003/graphql/stream',
    }),
    verify: (request) => this.authContext.create(request),
  });

  constructor(
    @Inject(AuthContextFactory)
    private readonly authContext: AuthContextFactory,
  ) {}

  use(request: Request, response: Response) {
    return this.handle(request, response);
  }
}
