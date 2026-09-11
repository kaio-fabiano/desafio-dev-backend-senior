import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

import gatewayGraphiqlPage from './gateway-graphiql-page.ts';

type GraphqlRequest = {
  operationName?: string;
  query: string;
};

type FetcherOptions = {
  documentAST: {
    definitions: Array<{
      kind: string;
      name?: { value: string };
      operation: string;
    }>;
  };
  headers: Record<string, string>;
};

it('@spec:AC-359 @principle:P-003 routes GraphiQL subscriptions through SSE with editor headers', async () => {
  const page = gatewayGraphiqlPage;
  const script = page.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  expect(script).toBeDefined();
  if (!script) throw new Error('Expected an inline GraphiQL script');

  const httpFetcher = vi.fn(async () => ({ data: { ok: true } }));
  const disposeSubscription = vi.fn();
  const disposeClient = vi.fn();
  const subscribe = vi.fn(() => disposeSubscription);
  const createClient = vi.fn(() => ({ dispose: disposeClient, subscribe }));
  let fetcher:
    | ((request: GraphqlRequest, options: FetcherOptions) => unknown)
    | undefined;

  const GraphiQL = {
    createFetcher: vi.fn(() => httpFetcher),
  };
  runInNewContext(script, {
    document: { getElementById: vi.fn() },
    GraphiQL,
    graphqlSse: { createClient },
    React: {
      createElement: vi.fn(
        (_component: unknown, props: { fetcher: typeof fetcher }) => {
          fetcher = props.fetcher;
          return {};
        },
      ),
    },
    ReactDOM: { render: vi.fn() },
  });

  expect(GraphiQL.createFetcher).toHaveBeenCalledWith({ url: '/graphql' });
  expect(fetcher).toBeDefined();
  if (!fetcher) throw new Error('Expected the GraphiQL fetcher');

  const headers = {
    Authorization: 'Bearer development-token',
    'X-Debug': 'true',
  };
  const options = (operation: string): FetcherOptions => ({
    documentAST: {
      definitions: [
        {
          kind: 'OperationDefinition',
          name: { value: 'Operation' },
          operation,
        },
      ],
    },
    headers,
  });
  const query = { operationName: 'Operation', query: 'query Operation { ok }' };
  const mutation = {
    operationName: 'Operation',
    query: 'mutation Operation { ok }',
  };
  await fetcher(query, options('query'));
  await fetcher(mutation, options('mutation'));
  expect(httpFetcher).toHaveBeenNthCalledWith(1, query, options('query'));
  expect(httpFetcher).toHaveBeenNthCalledWith(2, mutation, options('mutation'));

  const subscription = {
    operationName: 'Operation',
    query: 'subscription Operation { orderEvents { id } }',
  };
  const result = fetcher(subscription, options('subscription')) as {
    subscribe(observer: {
      complete(): void;
      error(error: unknown): void;
      next(value: unknown): void;
    }): { unsubscribe(): void };
  };
  expect(createClient).toHaveBeenCalledWith({
    headers,
    url: '/graphql/stream',
  });

  const active = result.subscribe({
    complete: vi.fn(),
    error: vi.fn(),
    next: vi.fn(),
  });
  expect(subscribe).toHaveBeenCalledWith(subscription, expect.any(Object));

  active.unsubscribe();
  expect(disposeSubscription).toHaveBeenCalledOnce();
  expect(disposeClient).toHaveBeenCalledOnce();
  expect(page).toContain('graphiql@3.8.3/graphiql.min.js');
  expect(page).toContain('graphql-sse@2.6.1/umd/graphql-sse.min.js');
});
