import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHandler } from 'graphql-sse/lib/use/http';

import type { AuthContext } from '../auth/auth-context.ts';
import { verifyGatewayRequest } from '../auth/token-verifier.ts';
import type { CommerceSubscriptionClient } from './commerce-subscription.client.ts';

type GatewayTokenOptions = {
  issuer: string;
  audience: string;
  requiredScopes: readonly string[];
};

type GatewaySseOptions = {
  commerce: CommerceSubscriptionClient;
  token: GatewayTokenOptions;
  verify?: typeof verifyGatewayRequest;
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
  token,
  verify = verifyGatewayRequest,
}: GatewaySseOptions) {
  const authenticated = new WeakMap<IncomingMessage, AuthContext>();
  const active = new WeakMap<IncomingMessage, AsyncGenerator>();
  const handler = createHandler<AuthContext>({
    authenticate: async ({ raw }) => {
      authenticated.set(raw, await verify(toRequest(raw), token));
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
      closing = Promise.resolve(subscription.return(undefined)).catch(() => {});
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
