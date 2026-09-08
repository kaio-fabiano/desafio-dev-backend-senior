import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { GatewaySseHandler } from './sse-handler.ts';

@Injectable()
export class GatewaySseMiddleware implements NestMiddleware {
  constructor(
    @Inject(GatewaySseHandler)
    private readonly handler: GatewaySseHandler,
  ) {}

  use(request: Request, response: Response) {
    return this.handler.handle(request, response);
  }
}
