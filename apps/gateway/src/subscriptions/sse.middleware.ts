import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { TokenVerifierService } from '@desafio-dev-backend-senior/source/gateway-nest';
import { createCommerceSubscriptionClient } from './commerce-subscription.client.ts';
import { createGatewaySseHandler } from './sse-handler.ts';

export class GatewaySseMiddleware implements NestMiddleware {
  private readonly handle = createGatewaySseHandler({
    commerce: createCommerceSubscriptionClient({
      url:
        process.env.COMMERCE_SUBSCRIPTION_URL ??
        'http://commerce-subgraph:3003/graphql/stream',
    }),
    verify: (request) => this.tokens.verify(request),
  });

  constructor(private readonly tokens: TokenVerifierService) {}

  use(request: Request, response: Response, _next: NextFunction) {
    return this.handle(request, response);
  }
}

Injectable()(GatewaySseMiddleware);
Inject(TokenVerifierService)(GatewaySseMiddleware, undefined, 0);
