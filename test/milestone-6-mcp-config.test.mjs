import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildSchema, parse, validate } from 'graphql';

const root = process.cwd();
const appDir = join(root, 'apps/apollo-mcp');
const operationsDir = join(appDir, 'operations');
const config = await readFile(join(appDir, 'mcp.yaml'), 'utf8');
const dockerfile = await readFile(join(appDir, 'Dockerfile'), 'utf8');
const schema = buildSchema(await readFile(join(appDir, 'schema.graphql'), 'utf8'));
const operationFiles = (await readdir(operationsDir))
  .filter((file) => file.endsWith('.graphql'))
  .sort();
const operations = await Promise.all(
  operationFiles.map(async (file) => ({
    file,
    document: parse(await readFile(join(operationsDir, file), 'utf8')),
  })),
);

const expectedTools = new Set([
  'me',
  'searchProducts',
  'getProduct',
  'getMyCart',
  'getMyOrders',
  'addToCart',
  'removeFromCart',
]);

test('AC-060: Only approved operations become tools @spec:AC-060', () => {
  assert.match(config, /operations:\n  source: local\n  paths:\n    - \/data\/operations/);
  assert.match(config, /schema:\n  source: local\n  path: \/data\/schema\.graphql/);
  assert.equal(operations.length, expectedTools.size);
  for (const { file, document } of operations) {
    assert.deepEqual(validate(schema, document), [], `${file} must match the pinned client schema`);
  }
  assert.match(dockerfile, /^FROM ghcr\.io\/apollographql\/apollo-mcp-server:v1\.17\.0(?: AS [\w-]+)?$/m);
  assert.match(dockerfile, /COPY(?: --chown=\S+)? apps\/apollo-mcp\/operations\/ \/data\/operations\//);
});

test('AC-061: Forbidden mutations and arbitrary GraphQL tools stay disabled @spec:AC-061', () => {
  assert.match(config, /mutation_mode: explicit/);
  assert.match(config, /introspection:\n  execute:\n    enabled: false\n  introspect:\n    enabled: false\n  search:\n    enabled: false\n  validate:\n    enabled: false/);
  assert.doesNotMatch(config, /source: (?:collection|graphos|infer|introspect|manifest|uplink)/);
  assert.doesNotMatch(config, /(?:apollo_key|apollo_graph_ref|APOLLO_KEY|APOLLO_GRAPH_REF)/);

  const mutationFields = new Set(operations.flatMap(({ document }) =>
    document.definitions
      .filter(({ kind, operation }) => kind === 'OperationDefinition' && operation === 'mutation')
      .flatMap(({ selectionSet }) => selectionSet.selections.map(({ name }) => name.value))));
  assert.deepEqual(mutationFields, new Set(['addToCart', 'removeFromCart']));
});

test('AC-062: Streamable HTTP rejects invalid MCP authentication at its resource boundary @spec:AC-062', () => {
  assert.match(config, /transport:\n  type: streamable_http/);
  assert.match(config, /servers:\n      - http:\/\/identity\.localhost:3001\/api\/auth/);
  assert.match(config, /audiences:\n      - https:\/\/mcp\.marketplace\.local/);
  assert.match(config, /issuers:\n      - http:\/\/identity\.localhost:3001\/api\/auth/);
  assert.match(config, /allow_any_audience: false/);
  assert.match(config, /resource: http:\/\/apollo-mcp:8000\/mcp/);
  assert.match(config, /allow_anonymous_mcp_discovery: false/);
});

test('AC-063: Every approved tool has an explicit least-privilege scope @spec:AC-063', () => {
  assert.match(config, /scopes:\n      - mcp:tools\n    scope_mode: require_all/);
  const expectedScopes = {
    me: 'marketplace:read',
    searchProducts: 'marketplace:read',
    getProduct: 'marketplace:read',
    getMyCart: 'cart:read',
    getMyOrders: 'orders:read',
    addToCart: 'cart:write',
    removeFromCart: 'cart:write',
  };
  assert.deepEqual(new Set(Object.keys(expectedScopes)), expectedTools);
  for (const [operation, scope] of Object.entries(expectedScopes)) {
    assert.match(config, new RegExp(`    ${operation}:\\n      - ${scope.replace(':', '\\:')}(?:\\n|$)`));
  }
});
