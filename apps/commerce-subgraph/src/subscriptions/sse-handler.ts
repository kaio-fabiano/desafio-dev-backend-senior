import type { IncomingMessage, ServerResponse } from 'node:http';

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
      response.end(JSON.stringify({ errors: [{ message: 'Subscription service is starting' }] }));
      return;
    }
    activeHandler(request, response);
  });
  return (handler) => {
    activeHandler = handler;
  };
}

export function createCommerceSseHandler(schema: GraphQLSchema) {
  const handler = createHandler({
    schema,
    context: ({ raw }: { raw: IncomingMessage }) => ({
      subject: String(raw.headers['x-authenticated-subject'] ?? ''),
    }),
  });
  return (request: IncomingMessage, response: ServerResponse) =>
    handler(request, response);
}
