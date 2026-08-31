import { createClient } from 'graphql-sse';
import { startGateway } from './federated-sse-gateway.ts';
import { startSubgraph } from './federated-sse-subgraph.ts';

async function receiveOneEvent(
  url: string,
  onContentType: (value: string) => void,
) {
  const client = createClient({
    url,
    singleConnection: false,
    retryAttempts: 0,
    headers: { connection: 'close' },
    fetchFn: async (...args: Parameters<typeof fetch>) => {
      const response = await fetch(...args);
      onContentType(response.headers.get('content-type') ?? '');
      return response;
    },
  });

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for the SSE event')),
      5_000,
    );
    let dispose = () => {};
    dispose = client.subscribe(
      {
        query:
          'subscription Status($orderId: ID!) { orderStatusChanged(orderId: $orderId) { orderId status } }',
        variables: { orderId: 'order-42' },
      },
      {
        next: (result) => {
          clearTimeout(timeout);
          dispose();
          resolve(result as Record<string, unknown>);
        },
        error: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        complete: () => {},
      },
    );
  }).finally(() => client.dispose());
}

const subgraphContentTypes: string[] = [];
const edgeContentTypes: string[] = [];
const subgraph = await startSubgraph();
const gateway = await startGateway(subgraph.url, (value) =>
  subgraphContentTypes.push(value),
);

try {
  const event = await receiveOneEvent(gateway.url, (value) =>
    edgeContentTypes.push(value),
  );
  console.log(
    JSON.stringify({
      decision: 'hybrid-graphql-sse-edge',
      directGatewaySubscriptionTransport: false,
      federation: 'v2',
      edgeContentType: edgeContentTypes.find((value) =>
        value.startsWith('text/event-stream'),
      ),
      subgraphContentType: subgraphContentTypes.find((value) =>
        value.startsWith('text/event-stream'),
      ),
      event,
    }),
  );
} finally {
  await gateway.close();
  await subgraph.close();
}
