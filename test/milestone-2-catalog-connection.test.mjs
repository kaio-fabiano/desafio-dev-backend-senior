import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import {
  fetchProductPage,
  publishWordPressSubgraph,
} from '../apps/poc-wordpress/scripts/publish-subgraph.mjs';

test('AC-031: Native catalog Connections paginate with opaque cursors @spec:AC-031', async (t) => {
  const products = ['A', 'B', 'C'].map((name, index) => ({ id: String(index + 1), name }));
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { query, variables } = JSON.parse(Buffer.concat(chunks));
    const data = query.includes('_service')
      ? { _service: { sdl: 'interface Product { id: ID! }' } }
      : (() => {
          const offset = variables.after ? Number(Buffer.from(variables.after, 'base64url')) : 0;
          const nodes = products.slice(offset, offset + variables.first);
          const next = offset + nodes.length;
          return {
            products: {
              nodes,
              pageInfo: {
                hasNextPage: next < products.length,
                hasPreviousPage: offset > 0,
                startCursor: nodes.length ? Buffer.from(String(offset)).toString('base64url') : null,
                endCursor: nodes.length ? Buffer.from(String(next)).toString('base64url') : null,
              },
            },
          };
        })();
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/graphql`;

  assert.match(await publishWordPressSubgraph(endpoint), /interface Product @key\(fields: "id"\)/);
  const first = await fetchProductPage(endpoint, 2);
  const second = await fetchProductPage(endpoint, 2, first.pageInfo.endCursor);
  assert.deepEqual(first.nodes.map(({ id }) => id), ['1', '2']);
  assert.deepEqual(second.nodes.map(({ id }) => id), ['3']);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.equal(second.pageInfo.hasNextPage, false);
  assert.ok(!first.pageInfo.endCursor.includes('2'));
});
