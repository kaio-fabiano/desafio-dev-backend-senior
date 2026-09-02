import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  type OAuthClaims,
  toOAuthRequest,
} from '@desafio-dev-backend-senior/source/platform-nest';
import type { GraphQLSchema } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';

type HttpHandler = (request: IncomingMessage, response: ServerResponse) => void;
type RouteRegistrar = {
  all(path: string, handler: HttpHandler): void;
};

export function registerDeferredSseRoute(
  router: RouteRegistrar,
  path: string,
): (handler: HttpHandler) => void {
  let activeHandler: HttpHandler | undefined;
  router.all(path, (request, response) => {
    if (!activeHandler) {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          errors: [{ message: 'Subscription service is starting' }],
        }),
      );
      return;
    }
    activeHandler(request, response);
  });
  return (handler) => {
    activeHandler = handler;
  };
}

export function createOrderWorkflowSseHandler(
  schema: GraphQLSchema,
  verify: (request: Request) => Promise<OAuthClaims>,
) {
  const authenticated = new WeakMap<IncomingMessage, OAuthClaims>();
  const handler = createHandler({
    schema,
    authenticate: async ({ raw }: { raw: IncomingMessage }) => {
      authenticated.set(raw, await verify(toOAuthRequest(raw)));
      return null;
    },
    context: ({ raw }: { raw: IncomingMessage }) => {
      const auth = authenticated.get(raw);
      if (!auth) throw new Error('Unauthenticated subscription');
      return {
        auth,
        req: raw,
      };
    },
  });
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      await handler(request, response);
    } finally {
      authenticated.delete(request);
    }
  };
}
