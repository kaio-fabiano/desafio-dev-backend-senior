import { GraphQLError } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { GatewayContext } from '@desafio-dev-backend-senior/source/gateway-nest';
import type { OrderWorkflowSubscriptionClient } from './order-workflow-subscription.client.ts';

type GatewaySseOptions = {
  orderWorkflow: OrderWorkflowSubscriptionClient;
  verify: (request: IncomingMessage) => Promise<GatewayContext>;
};

export function createGatewaySseHandler({
  orderWorkflow,
  verify,
}: GatewaySseOptions) {
  const authenticated = new WeakMap<IncomingMessage, GatewayContext>();
  const active = new WeakMap<IncomingMessage, AsyncGenerator>();
  const handler = createHandler<GatewayContext>({
    authenticate: async ({ raw }) => {
      authenticated.set(raw, await verify(raw));
      return null;
    },
    context: ({ raw }) => {
      const context = authenticated.get(raw);
      if (!context) throw new Error('Unauthenticated subscription');
      return context;
    },
    onSubscribe: (_request, params) => {
      const context = authenticated.get(_request.raw);
      if (!context) throw new Error('Unauthenticated subscription');
      const subscription = orderWorkflow.subscribe(params, context);
      active.set(_request.raw, subscription);
      return subscription;
    },
  });

  return async (request: IncomingMessage, response: ServerResponse) => {
    let closing: Promise<unknown> | undefined;
    const closeSubscription = () => {
      const subscription = active.get(request);
      if (!subscription || closing) return;
      closing = Promise.resolve(subscription.return(undefined)).catch(() => {
        // Connection shutdown is best-effort after the client disconnects.
      });
    };
    request.once('aborted', closeSubscription);
    response.once('close', closeSubscription);
    try {
      await handler(request, response);
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
      active.delete(request);
      authenticated.delete(request);
    }
  };
}
