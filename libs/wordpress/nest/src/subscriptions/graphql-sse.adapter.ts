import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type { GraphQLSchema } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';

import {
  SubscriptionAuthGuard,
  type SubscriptionContext,
} from './subscription-auth.guard.ts';

export class GraphqlSseAdapter implements OnModuleInit, OnApplicationBootstrap {
  readonly path = '/graphql/stream';
  private schema?: GraphQLSchema;
  private handler?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>;

  constructor(
    private readonly schemaHost: GraphQLSchemaHost,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly auth: SubscriptionAuthGuard,
  ) {}

  get executableSchema(): GraphQLSchema {
    if (!this.schema) throw new Error('GraphQL SSE adapter is not initialized');
    return this.schema;
  }

  onModuleInit(): void {
    this.httpAdapterHost.httpAdapter.all(
      this.path,
      async (request: IncomingMessage, response: ServerResponse) => {
        if (!this.handler) {
          response.writeHead(503);
          response.end();
          return;
        }
        await this.handler(request, response);
      },
    );
  }

  onApplicationBootstrap(): void {
    this.schema = this.schemaHost.schema;
    const contexts = new WeakMap<IncomingMessage, SubscriptionContext>();
    const handler = createHandler<SubscriptionContext>({
      schema: this.schema,
      authenticate: async ({ raw }) => {
        try {
          contexts.set(raw, await this.auth.authenticate(raw));
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

    this.handler = async (request, response) => {
        try {
          await handler(request, response);
        } catch {
          if (!response.headersSent) response.writeHead(500);
          response.end();
        } finally {
          contexts.delete(request);
        }
      };
  }
}

Inject(GraphQLSchemaHost)(GraphqlSseAdapter, undefined, 0);
Inject(HttpAdapterHost)(GraphqlSseAdapter, undefined, 1);
Inject(SubscriptionAuthGuard)(GraphqlSseAdapter, undefined, 2);
Injectable()(GraphqlSseAdapter);
