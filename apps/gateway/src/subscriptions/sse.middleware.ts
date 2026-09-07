import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthContextFactory } from '@desafio-dev-backend-senior/source/gateway-nest';
import { GatewaySseProvider } from './gateway-sse.provider.ts';
import { GatewaySseHandler } from './sse-handler.ts';

@Injectable()
export class GatewaySseMiddleware implements NestMiddleware {
  private readonly handler: GatewaySseHandler;

  constructor(
    @Inject(AuthContextFactory)
    private readonly authContext: AuthContextFactory,
  ) {
    this.handler = GatewaySseProvider.create((request) =>
      this.authContext.create(request),
    );
  }

  use(request: Request, response: Response) {
    return this.handler.handle(request, response);
  }
}
