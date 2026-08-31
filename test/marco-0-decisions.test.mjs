import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const files = await Promise.all([
  readFile('docs/adrs/001-graphql-sse-federado.md', 'utf8'),
  readFile('docs/adrs/002-oauth-multi-resource.md', 'utf8'),
  readFile('docs/adrs/003-wordpress-federation.md', 'utf8'),
  readFile('docs/adrs/004-restricoes-de-entrega.md', 'utf8'),
  readFile('docs/prds/08-riscos-e-decisoes-pendentes.md', 'utf8'),
]);

test('AC-015: Each proof closes a decision with evidence @spec:AC-015', () => {
  const [sse, auth, wordpress, delivery] = files;
  for (const [adr, evidence] of [
    [
      sse,
      [
        '@apollo/gateway` 2.14.4',
        'graphql-sse` 2.6.1',
        'corepack pnpm@10.17.1 exec nx run',
        'hybrid-graphql-sse-edge',
      ],
    ],
    [
      auth,
      [
        'better-auth@1.7.1',
        'corepack pnpm@10.17.1 exec nx run',
        'RFC 8707',
        'Adopt one JWT',
      ],
    ],
    [
      wordpress,
      [
        '6.8.2-php8.3-apache',
        'ac480974ceb6a1680410f955005e060056f150da',
        'node apps/wordpress-integration/scripts/probe.mjs',
        'Adopt the indicated plugins',
      ],
    ],
  ]) {
    for (const item of evidence)
      assert.ok(adr.includes(item), `ADR is missing evidence: ${item}`);
  }
  assert.match(delivery, /ADR 00[1-3]/);
});

test('AC-016: Delivery constraints remain explicit @spec:AC-016', () => {
  const [, , , delivery, prd] = files;
  assert.match(delivery, /SST v3/);
  assert.match(delivery, /2026-09-03/);
  assert.match(delivery, /date only/);
  assert.match(prd, /D-008.*decided/);
  assert.match(prd, /D-009.*closed; date only/);
});
