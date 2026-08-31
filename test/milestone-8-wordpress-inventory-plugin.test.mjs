import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-084: WooCommerce owns inventory without a marketplace MU-plugin @spec:AC-084', async () => {
  await assert.rejects(() =>
    access('apps/wordpress-integration/marketplace-inventory.php'),
  );
  const [compose, install] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    readFile('apps/wordpress-integration/scripts/install-plugins.sh', 'utf8'),
  ]);
  assert.doesNotMatch(
    compose,
    /marketplace-inventory\.php|MARKETPLACE_FEDERATION_SECRET/,
  );
  assert.match(install, /woocommerce\.10\.4\.3\.zip/);
  assert.match(install, /wp-graphql-headless-login/);
  assert.match(install, /wpgraphql_login_provider_siteToken/);
});

test('AC-084: each active backend uses an isolated WooCommerce credential @spec:AC-084', async () => {
  const compose = await readFile('compose.yaml', 'utf8');
  assert.match(compose, /Marketplace identity/);
  assert.doesNotMatch(compose, /Marketplace local runtime/);
  assert.match(compose, /DISABLE_WP_CRON/);
  assert.match(compose, /127\.0\.0\.1\/readme\.html/);
  assert.doesNotMatch(compose, /127\.0\.0\.1\/wp-login\.php/);
});
