import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type { GraphQLSchema } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';

import {
  SubscriptionAuthGuard,
  type SubscriptionContext,
} from './subscription-auth.guard.ts';

export class GraphqlSseAdapter implements OnApplicationBootstrap {
  readonly path = '/graphql/stream';
  private schema?: GraphQLSchema;

  constructor(
    private readonly schemaHost: GraphQLSchemaHost,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly auth: SubscriptionAuthGuard,
  ) {}

  get executableSchema(): GraphQLSchema {
    if (!this.schema) throw new Error('GraphQL SSE adapter is not initialized');
    return this.schema;
  }

  onApplicationBootstrap(): void {
    const schema = this.schemaHost.schema;
    const contexts = new WeakMap<IncomingMessage, SubscriptionContext>();
    const handler = createHandler<SubscriptionContext>({
      schema,
      authenticate: ({ raw }) => {
        try {
          contexts.set(raw, this.auth.authenticate(raw));
          return null;
        } catch (error) {
          const status =
            typeof error === 'object' &&
            error !== null &&
            'getStatus' in error &&
            typeof error.getStatus === 'function'
              ? error.getStatus()
              : 401;
          return [
            null,
            {
              status,
              statusText: status === 403 ? 'Forbidden' : 'Unauthorized',
            },
          ];
        }
      },
      context: ({ raw }) => {
        const context = contexts.get(raw);
        if (!context) throw new Error('Unauthenticated subscription');
        return context;
      },
    });

    this.schema = schema;
    this.httpAdapterHost.httpAdapter.all(
      this.path,
      async (request: IncomingMessage, response: ServerResponse) => {
        try {
          await handler(request, response);
        } catch {
          if (!response.headersSent) response.writeHead(500);
          response.end();
        } finally {
          contexts.delete(request);
        }
      },
    );
  }
}

Inject(GraphQLSchemaHost)(GraphqlSseAdapter, undefined, 0);
Inject(HttpAdapterHost)(GraphqlSseAdapter, undefined, 1);
Inject(SubscriptionAuthGuard)(GraphqlSseAdapter, undefined, 2);
Injectable()(GraphqlSseAdapter);
