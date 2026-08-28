import type { IncomingMessage, ServerResponse } from 'node:http';

import type { GraphQLSchema } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';

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
