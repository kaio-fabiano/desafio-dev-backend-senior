import { Inject, Injectable } from '@nestjs/common';
import { GraphQLError, type ExecutionResult } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  AuthContextFactory,
  ForwardGatewaySubscriptionUseCase,
  type GatewayContext,
} from '@desafio-dev-backend-senior/source/gateway-nest';

@Injectable()
export class GatewaySseHandler {
  private readonly authenticated = new WeakMap<
    IncomingMessage,
    GatewayContext
  >();
  private readonly active = new WeakMap<
    IncomingMessage,
    AsyncGenerator<unknown>
  >();
  private readonly handler = createHandler<GatewayContext>({
    authenticate: async ({ raw }) => {
      this.authenticated.set(raw, await this.authContext.create(raw));
      return null;
    },
    context: ({ raw }) => {
      const context = this.authenticated.get(raw);
      if (!context) throw new Error('Unauthenticated subscription');
      return context;
    },
    onSubscribe: (request, params) => {
      const context = this.authenticated.get(request.raw);
      if (!context) throw new Error('Unauthenticated subscription');
      const subscription = this.subscriptions.execute(params, context);
      this.active.set(request.raw, subscription);
      return subscription as AsyncGenerator<ExecutionResult>;
    },
  });

  constructor(
    @Inject(AuthContextFactory)
    private readonly authContext: AuthContextFactory,
    @Inject(ForwardGatewaySubscriptionUseCase)
    private readonly subscriptions: ForwardGatewaySubscriptionUseCase,
  ) {}

  async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let closing: Promise<unknown> | undefined;
    const closeSubscription = () => {
      const subscription = this.active.get(request);
      if (!subscription || closing) return;
      closing = Promise.resolve(subscription.return(undefined)).catch(() => {
        // Connection shutdown is best-effort after the client disconnects.
      });
    };
    request.once('aborted', closeSubscription);
    response.once('close', closeSubscription);
    try {
      await this.handler(request, response);
    } catch (error) {
      if (!response.headersSent)
        response.writeHead(
          error instanceof GraphQLError &&
            error.extensions.code === 'UNAUTHENTICATED'
            ? 401
            : 502,
        );
      response.end();
    } finally {
      closeSubscription();
      await closing;
      request.off('aborted', closeSubscription);
      response.off('close', closeSubscription);
      this.active.delete(request);
      this.authenticated.delete(request);
    }
  }
}
