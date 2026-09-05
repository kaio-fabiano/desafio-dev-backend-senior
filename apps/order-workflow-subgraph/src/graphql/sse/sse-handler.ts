import {
  isOAuthCredentialError,
  type OAuthClaims,
  toOAuthRequest,
} from '@desafio-dev-backend-senior/source/platform-nest';
import type { GraphQLSchema } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/express';
import type { Request, Response } from 'express';

type AuthenticatedRequest = {
  auth: OAuthClaims;
};

export function createOrderWorkflowSseHandler(
  schema: GraphQLSchema | (() => GraphQLSchema),
  verify: (request: globalThis.Request) => Promise<OAuthClaims>,
) {
  const authenticated = new WeakMap<Request, AuthenticatedRequest>();
  const controllers = new WeakMap<Request, AbortController>();
  const handler = createHandler({
    schema: typeof schema === 'function' ? () => schema() : schema,
    authenticate: async ({ raw }) => {
      try {
        authenticated.set(raw, {
          auth: await verify(toOAuthRequest(raw)),
        });
      } catch (error) {
        if (!isOAuthCredentialError(error)) throw error;
        return [
          JSON.stringify({ errors: [{ message: 'Unauthorized' }] }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'content-type': 'application/json; charset=utf-8' },
          },
        ] as const;
      }
      return null;
    },
    context: ({ raw }) => {
      return {
        auth: (authenticated.get(raw) as AuthenticatedRequest).auth,
        req: raw,
        signal: (controllers.get(raw) as AbortController).signal,
      };
    },
  });
  return async (
    request: Request,
    response: Response,
    abort: AbortController,
  ) => {
    controllers.set(request, abort);
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const closeSubscription = () => {
      abort.abort();
      resolveClosed();
    };
    request.once('aborted', closeSubscription);
    response.once('close', closeSubscription);
    try {
      await Promise.race([handler(request, response), closed]);
    } finally {
      closeSubscription();
      request.off('aborted', closeSubscription);
      response.off('close', closeSubscription);
      controllers.delete(request);
      authenticated.delete(request);
    }
  };
}
