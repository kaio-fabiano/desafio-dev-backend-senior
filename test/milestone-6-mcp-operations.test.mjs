import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const operationsDir = join(process.cwd(), 'apps/apollo-mcp/operations');
const expectedTools = new Set([
  'me', 'searchProducts', 'getProduct', 'getMyCart',
  'getMyOrders', 'addToCart',
]);

async function manifest() {
  const files = (await readdir(operationsDir)).filter((file) => file.endsWith('.graphql'));
  return Promise.all(files.map(async (file) => ({ file, source: await readFile(join(operationsDir, file), 'utf8') })));
}

test('AC-060: Only approved operations become tools @spec:AC-060', async () => {
  const entries = await manifest();
  const names = new Set(entries.flatMap(({ source }) => [...source.matchAll(/(?:query|mutation)\s+(\w+)/g)].map((match) => match[1])));
  assert.deepEqual(names, expectedTools);
});

test('AC-061: Forbidden mutations cannot be invoked @spec:AC-061', async () => {
  const entries = await manifest();
  const source = entries.map(({ source }) => source).join('\n');
  assert.doesNotMatch(source, /\b(?:checkout|payment|administration|execute|introspection)\b/i);
  assert.doesNotMatch(source, /mutation\s+\w*(?:checkout|payment|catalog|supplier|administration)\w*/i);
});

test('AC-138: Product discovery and lookup have distinct contracts @spec:AC-138', async () => {
  const entries = await manifest();
  const sourceByFile = new Map(entries.map(({ file, source }) => [file, source]));
  const search = sourceByFile.get('search-products.graphql');
  const lookup = sourceByFile.get('get-product.graphql');

  assert.match(search, /query searchProducts\(\$first: Int, \$after: String\)/);
  assert.match(search, /products\(first: \$first, after: \$after\)/);
  assert.match(search, /nodes\s*\{[\s\S]*?id[\s\S]*?name[\s\S]*?price/);
  assert.match(search, /pageInfo\s*\{\s*hasNextPage\s+endCursor\s*\}/);
  assert.doesNotMatch(search, /\bproduct\s*\(/);
  assert.match(lookup, /\bproduct\(id: \$productId\)/);
  assert.doesNotMatch(lookup, /\bproducts\s*\(/);
});
