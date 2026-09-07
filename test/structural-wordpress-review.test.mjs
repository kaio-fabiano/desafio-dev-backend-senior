import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const reconciliationPlugin =
  'apps/wordpress-integration/plugins/order-workflow-reconciliation';

test('AC-266: the WooCommerce reconciliation plugin has thin native boundaries @spec:AC-266 @spec:AC-268', async () => {
  const php = await readFile(
    `${reconciliationPlugin}/order-workflow-reconciliation.php`,
    'utf8',
  );

  assert.match(php, /declare\( strict_types=1 \);/);
  assert.match(php, /namespace Marketplace\\OrderWorkflowReconciliation;/);
  assert.match(php, /defined\( 'ABSPATH' \) \|\| exit;/);
  assert.doesNotMatch(php, /^function\s+/m);
  assert.doesNotMatch(php, /^const\s+/m);
  assert.match(php, /final class Hpos_Compatibility/);
  assert.match(php, /final class Order_Search_Fields/);
  assert.match(php, /final class Plugin/);
  assert.match(php, /new Plugin\s*\(/);
  assert.match(php, /->register_hooks\s*\(\s*\)/);
  assert.match(
    php,
    /FeaturesUtil::declare_compatibility\(\s*'custom_order_tables',\s*\$this->plugin_file,\s*true\s*\)/,
  );
  assert.match(php, /_order_workflow_operation_reference/);
  assert.match(php, /array_unique\( \$meta_keys \)/);
  assert.match(php, /before_woocommerce_init/);
  assert.match(php, /woocommerce_shop_order_search_fields/);
  assert.match(php, /woocommerce_order_table_search_query_meta_keys/);

  assert.doesNotMatch(
    php,
    /\$_(?:GET|POST|REQUEST|COOKIE|FILES)|register_rest_route|wp_ajax_|admin_post_/,
  );
  assert.doesNotMatch(
    php,
    /\b(?:get_posts|WP_Query|get_post_meta|update_post_meta|wp_update_post)\b/,
  );
});

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
