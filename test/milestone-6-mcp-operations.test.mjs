import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const operationsDir = join(process.cwd(), 'apps/apollo-mcp/operations');
const expectedTools = new Set([
  'me', 'searchProducts', 'getProduct', 'getMyCart',
  'getMyOrders', 'addToCart', 'removeFromCart',
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
