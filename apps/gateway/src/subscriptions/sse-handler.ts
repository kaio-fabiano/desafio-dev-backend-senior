import { GraphQLError } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { GatewayContext } from '@desafio-dev-backend-senior/source/gateway-nest';
import { GatewaySseOptions } from './gateway-sse.options.ts';

export class GatewaySseHandler {
  private readonly authenticated = new WeakMap<IncomingMessage, GatewayContext>();
  private readonly active = new WeakMap<IncomingMessage, AsyncGenerator>();
  private readonly handler = createHandler<GatewayContext>({
    authenticate: async ({ raw }) => { this.authenticated.set(raw, await this.options.verify(raw)); return null; },
    context: ({ raw }) => { const context = this.authenticated.get(raw); if (!context) throw new Error('Unauthenticated subscription'); return context; },
    onSubscribe: (request, params) => { const context = this.authenticated.get(request.raw); if (!context) throw new Error('Unauthenticated subscription'); const subscription = this.options.orderWorkflow.subscribe(params, context); this.active.set(request.raw, subscription); return subscription; },
  });

  constructor(private readonly options: GatewaySseOptions) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
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
