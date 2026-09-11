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
    Headers,
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

  expect(GraphiQL.createFetcher).toHaveBeenCalledWith({
    fetch: expect.any(Function),
    url: '/graphql',
  });
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
    headers: {
      authorization: 'Bearer development-token',
      'x-debug': 'true',
    },
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

it('@spec:AC-360 @principle:P-003 reuses addToCart session headers for checkout and subscriptions', async () => {
  const page = gatewayGraphiqlPage;
  const script = page.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  expect(script).toBeDefined();
  if (!script) throw new Error('Expected an inline GraphiQL script');

  const browserFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { addToCart: { ok: true } } }), {
        headers: {
          'cart-token': 'learned-cart',
          'woocommerce-session': 'learned-session',
          'x-ignored': 'ignored',
        },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { checkout: { ok: true } } })),
    );
  const disposeSubscription = vi.fn();
  const disposeClient = vi.fn();
  const subscribe = vi.fn(() => disposeSubscription);
  const createClient = vi.fn(
    (options: { headers?: Record<string, string>; url: string }) => {
      void options;
      return { dispose: disposeClient, subscribe };
    },
  );
  let fetcher:
    | ((request: GraphqlRequest, options: FetcherOptions) => unknown)
    | undefined;

  const GraphiQL = {
    createFetcher: vi.fn(
      ({
        fetch: configuredFetch = browserFetch,
        url,
      }: {
        fetch?: typeof fetch;
        url: string;
      }) =>
        async (request: GraphqlRequest, options: FetcherOptions) => {
          const response = await configuredFetch(url, {
            body: JSON.stringify(request),
            headers: options.headers,
            method: 'POST',
          });
          return response.json();
        },
    ),
  };
  runInNewContext(script, {
    document: { getElementById: vi.fn() },
    fetch: browserFetch,
    GraphiQL,
    graphqlSse: { createClient },
    Headers,
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

  expect(fetcher).toBeDefined();
  if (!fetcher) throw new Error('Expected the GraphiQL fetcher');

  const options = (operation: string, headers: Record<string, string>) => ({
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
  await fetcher(
    { operationName: 'Operation', query: 'mutation Operation { addToCart }' },
    options('mutation', { Authorization: 'Bearer development-token' }),
  );
  await fetcher(
    { operationName: 'Operation', query: 'mutation Operation { checkout }' },
    options('mutation', {
      Authorization: 'Bearer development-token',
      'Cart-Token': 'editor-cart',
    }),
  );

  expect(browserFetch).toHaveBeenCalledTimes(2);
  const [checkoutUrl, checkoutInit] = browserFetch.mock.calls[1] ?? [];
  expect(checkoutUrl).toBe('/graphql');
  expect(checkoutInit?.method).toBe('POST');
  const checkoutHeaders = new Headers(checkoutInit?.headers);
  expect(checkoutHeaders.get('authorization')).toBe('Bearer development-token');
  expect(checkoutHeaders.get('cart-token')).toBe('editor-cart');
  expect(checkoutHeaders.get('woocommerce-session')).toBe(
    'Session learned-session',
  );
  expect(checkoutHeaders.has('x-ignored')).toBe(false);

  fetcher(
    {
      operationName: 'Operation',
      query: 'subscription Operation { orderEvents { id } }',
    },
    options('subscription', { Authorization: 'Bearer development-token' }),
  );
  const sseHeaders = new Headers(createClient.mock.calls[0]?.[0].headers);
  expect(sseHeaders.get('authorization')).toBe('Bearer development-token');
  expect(sseHeaders.get('cart-token')).toBe('learned-cart');
  expect(sseHeaders.get('woocommerce-session')).toBe('Session learned-session');
  expect(sseHeaders.has('x-ignored')).toBe(false);
});
