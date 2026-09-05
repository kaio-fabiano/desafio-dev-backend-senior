import type { BeforeApplicationShutdown, NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type { Request, Response } from 'express';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import { createOrderWorkflowSseHandler } from './sse-handler.ts';

@Injectable()
export class OrderWorkflowSseConnections implements BeforeApplicationShutdown {
  private readonly active = new Map<Response, AbortController>();
  private readonly pending = new Set<Promise<void>>();
  private stopping = false;

  track(
    response: Response,
    abort: AbortController,
    start: () => Promise<void>,
  ): Promise<void> {
    if (this.stopping) {
      response.status(503).json({
        errors: [{ message: 'Subscription service is shutting down' }],
      });
      return Promise.resolve();
    }
    this.active.set(response, abort);
    const running = start().finally(() => {
      this.active.delete(response);
      this.pending.delete(running);
    });
    this.pending.add(running);
    return running;
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    for (const abort of this.active.values()) abort.abort();
    await Promise.allSettled(this.pending);
  }
}

@Injectable()
export class OrderWorkflowSseMiddleware implements NestMiddleware {
  private readonly handle = createOrderWorkflowSseHandler(
    () => this.schemaHost.schema,
    (request) => this.resources.verify(request),
  );

  constructor(
    @Inject(GraphQLSchemaHost)
    private readonly schemaHost: GraphQLSchemaHost,
    @Inject(OAuthResourceService)
    private readonly resources: OAuthResourceService,
    @Inject(OrderWorkflowSseConnections)
    private readonly connections: OrderWorkflowSseConnections,
  ) {}

  use(request: Request, response: Response): Promise<void> {
    const abort = new AbortController();
    return this.connections.track(response, abort, () =>
      this.handle(request, response, abort),
    );
  }
}
