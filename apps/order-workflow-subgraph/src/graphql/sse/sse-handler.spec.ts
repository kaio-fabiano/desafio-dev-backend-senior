import express from 'express';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

import { createOrderWorkflowSseHandler } from './sse-handler.ts';

const applicationRequire = createRequire(import.meta.url);
const { buildSchema } = createRequire(
  applicationRequire.resolve('graphql-sse'),
)('graphql') as typeof import('graphql');

describe('createOrderWorkflowSseHandler', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
    );
  });

  it('supports a static schema and completes a single-result SSE request @spec:AC-231', async () => {
    const schema = buildSchema('type Query { ping: String }');
    const handle = createOrderWorkflowSseHandler(schema, async () => ({
      audience: ['https://order-workflow.marketplace.local'],
      claims: {},
      scopes: ['orders:read'],
      subject: 'buyer-231',
    }));
    const abort = new AbortController();
    const application = express();
    application.use(express.json());
    application.post('/graphql/stream', (request, response, next) => {
      void handle(request, response, abort).catch(next);
    });
    const server = createServer(application);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Test server did not bind');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/graphql/stream`,
      {
        method: 'POST',
        headers: {
          accept: 'text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: '{ ping }' }),
      },
    );

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain('event: next\ndata: {"data":{"ping":null}}');
    expect(abort.signal.aborted).toBe(true);
  });
});
