import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { createHandler } from 'graphql-sse/lib/use/http';

export const federationTypeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.11", import: ["@key"])

  type Query {
    order(id: ID!): Order
  }

  type Subscription {
    orderStatusChanged(orderId: ID!): OrderStatusEvent!
  }

  type Order @key(fields: "id") {
    id: ID!
    status: String!
  }

  type OrderStatusEvent {
    orderId: ID!
    status: String!
  }
`);

const resolvers = {
  Query: {
    order: (_source: unknown, { id }: { id: string }) => ({
      id,
      status: 'PAID',
    }),
  },
  Order: {
    __resolveReference: ({ id }: { id: string }) => ({ id, status: 'PAID' }),
  },
  Subscription: {
    orderStatusChanged: {
      async *subscribe(_source: unknown, { orderId }: { orderId: string }) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield { orderStatusChanged: { orderId, status: 'PAID' } };
      },
    },
  },
};

export const subgraphSchema = buildSubgraphSchema({
  typeDefs: federationTypeDefs,
  resolvers,
});

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Subgraph did not bind a TCP port');
  return `http://127.0.0.1:${address.port}/graphql`;
}

export async function startSubgraph() {
  const handler = createHandler({ schema: subgraphSchema });
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
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
