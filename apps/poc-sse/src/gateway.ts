import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { ApolloGateway } from '@apollo/gateway';
import { print, type ExecutionArgs, type ExecutionResult } from 'graphql';
import { createClient, type Client } from 'graphql-sse';
import { createHandler } from 'graphql-sse/lib/use/http';
import { federationTypeDefs } from './subgraph.ts';

type QueueEntry = IteratorResult<ExecutionResult>;

function subscriptionIterator(
  client: Client,
  args: ExecutionArgs,
): AsyncIterableIterator<ExecutionResult> {
  const queued: QueueEntry[] = [];
  const waiting: Array<(entry: QueueEntry) => void> = [];
  let failure: unknown;

  const push = (entry: QueueEntry) =>
    waiting.shift()?.(entry) ?? queued.push(entry);
  const dispose = client.subscribe(
    {
      query: print(args.document),
      variables: args.variableValues ?? undefined,
      operationName: args.operationName ?? undefined,
    },
    {
      next: (value) => push({ done: false, value: value as ExecutionResult }),
      error: (error) => {
        failure = error;
        push({ done: true, value: undefined });
      },
      complete: () => push({ done: true, value: undefined }),
    },
  );

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      const entry =
        queued.shift() ??
        (await new Promise<QueueEntry>((resolve) => waiting.push(resolve)));
      if (failure) throw failure;
      return entry;
    },
    async return() {
      dispose();
      return { done: true, value: undefined };
    },
  };
}

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Gateway did not bind a TCP port');
  return `http://127.0.0.1:${address.port}/graphql`;
}

export async function startGateway(
  subgraphUrl: string,
  onSubgraphContentType: (value: string) => void,
) {
  const gateway = new ApolloGateway({
    localServiceList: [{ name: 'orders', typeDefs: federationTypeDefs }],
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  });
  const { schema } = await gateway.load();
  const subgraphClient = createClient({
    url: subgraphUrl,
    singleConnection: false,
    retryAttempts: 0,
    headers: { connection: 'close' },
    fetchFn: async (...args: Parameters<typeof fetch>) => {
      const response = await fetch(...args);
      onSubgraphContentType(response.headers.get('content-type') ?? '');
      return response;
    },
  });
  const handler = createHandler({
    schema,
    subscribe: (args) => subscriptionIterator(subgraphClient, args),
  });
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/graphql')) {
      void handler(request, response);
      return;
    }
    response.writeHead(404).end();
  });

  const url = await listen(server);
  return {
    url,
    close: async () => {
      subgraphClient.dispose();
      await gateway.stop();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
