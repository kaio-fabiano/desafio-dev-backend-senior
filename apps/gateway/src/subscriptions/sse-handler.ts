import { createHandler } from 'graphql-sse/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthContext } from '@desafio-dev-backend-senior/source/gateway-nest';
import type { CommerceSubscriptionClient } from './commerce-subscription.client.ts';

type GatewaySseOptions = {
  commerce: CommerceSubscriptionClient;
  verify: (request: Request) => Promise<AuthContext>;
};

function toRequest(request: IncomingMessage) {
  const host = request.headers.host ?? 'gateway.local';
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    headers.append(request.rawHeaders[index]!, request.rawHeaders[index + 1]!);
  }
  return new Request(
    new URL(request.url ?? '/graphql/stream', `http://${host}`),
    {
      method: request.method,
      headers,
    },
  );
}

export function createGatewaySseHandler({
  commerce,
  verify,
}: GatewaySseOptions) {
  const authenticated = new WeakMap<IncomingMessage, AuthContext>();
  const active = new WeakMap<IncomingMessage, AsyncGenerator>();
  const handler = createHandler<AuthContext>({
    authenticate: async ({ raw }) => {
      authenticated.set(raw, await verify(toRequest(raw)));
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
      const subscription = commerce.subscribe(params, context);
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
    } catch {
      if (!response.headersSent)
        response.writeHead(authenticated.has(request) ? 502 : 401);
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
