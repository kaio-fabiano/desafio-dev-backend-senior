import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-084: WordPress inventory route authenticates, validates, and compensates @spec:AC-084', async () => {
  const source = await readFile(
    new URL('../apps/wordpress-integration/marketplace-inventory.php', import.meta.url),
    'utf8',
  );
  assert.match(source, /current_user_can\('manage_woocommerce'\)/);
  assert.match(source, /option_active_plugins/);
  assert.match(source, /wp-graphql-federations\//);
  assert.match(source, /\/wp-json\/marketplace\/v1\/inventory\/reserve/);
  assert.match(source, /wc_api_hash\(\$consumer_key\)/);
  assert.match(source, /hash_equals\(\$api_key->consumer_secret, \$consumer_secret\)/);
  assert.match(source, /\['write', 'read_write'\]/);
  assert.match(source, /wc_get_product/);
  assert.match(source, /count\(\$items\) === 0/);
  assert.match(source, /array_reverse\(\$changed\)/);
  assert.match(source, /wc_update_product_stock\([^;]+, 'increase'\)/s);
});

test('AC-084: each backend uses an isolated WooCommerce credential @spec:AC-084', async () => {
  const compose = await readFile(new URL('../compose.yaml', import.meta.url), 'utf8');
  for (const digit of ['1', '2', '3']) {
    const key = `ck_${digit.repeat(40)}`;
    const secret = `cs_${digit.repeat(40)}`;
    assert.equal(compose.match(new RegExp(key, 'g'))?.length, 2);
    assert.equal(compose.match(new RegExp(secret, 'g'))?.length, 2);
  }
  assert.doesNotMatch(compose, /Marketplace local runtime/);
});
