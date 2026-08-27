import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const files = [
  'README.md', 'docs/runbooks/local-development.md', 'docs/runbooks/e2e.md',
  'docs/runbooks/deployment.md', 'docs/operations/marketplace.http',
  'docs/evidence/mcp/README.md', 'docs/evidence/milestone-7/README.md',
];
const text = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')])));

test('AC-077: final documentation links executable evidence and safe operations @spec:AC-077', () => {
  assert.match(text['README.md'], /runbooks\/e2e\.md/);
  assert.match(text['docs/evidence/milestone-7/README.md'], /requirements\.md/);
  assert.match(text['docs/operations/marketplace.http'], /MARKETPLACE_ACCESS_TOKEN/);
  for (const content of Object.values(text)) assert.doesNotMatch(content, /Bearer\s+[A-Za-z0-9._~-]{20,}/);
});
