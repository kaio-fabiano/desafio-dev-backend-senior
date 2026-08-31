import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { composeServices } from '../node_modules/.pnpm/@apollo+composition@2.14.4_graphql@16.11.0/node_modules/@apollo/composition/dist/index.js';

test('AC-020: The Milestone 1 supergraph composes @spec:AC-020', async () => {
  const config = await readFile('libs/contracts/graphql/supergraph.yaml', 'utf8');
  const names = ['identity', 'catalog', 'commerce'];
  const services = await Promise.all(names.map(async (name) => ({
    name,
    url: `http://${name}/graphql`,
    typeDefs: await readFile(`libs/contracts/graphql/${name}/schema.graphql`, 'utf8'),
  })));
  const result = composeServices(services);

  assert.match(config, /federation_version: =2\.11/);
  assert.equal(result.errors?.length ?? 0, 0, result.errors?.map((error) => error.message).join('\n'));
  assert.match(result.supergraphSdl, /CheckoutOperation/);
});
