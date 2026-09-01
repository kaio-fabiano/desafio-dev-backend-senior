import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-125: WordPress bootstrap stays minimal and reproducible @spec:AC-125', async () => {
  const [compose, probe] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    readFile('apps/wordpress-integration/scripts/probe.mjs', 'utf8'),
  ]);
  assert.match(
    compose,
    /wordpress-setup:[\s\S]*?environment:\s+WPGRAPHQL_SITE_TOKEN: \$\{WPGRAPHQL_SITE_TOKEN:-wordpress-local-only\}/,
  );
  assert.match(compose, /secretKey.*\$\$\{WPGRAPHQL_SITE_TOKEN\}/);
  assert.match(compose, /wp user update vendor-alpha/);
  assert.match(compose, /wp post update 1001 --post_author/);
  assert.match(probe, /finally \{\s*database\('SET GLOBAL general_log=OFF;'\)/);
  await assert.rejects(
    access('apps/wordpress-integration/scripts/publish-subgraph.mjs'),
  );
});
