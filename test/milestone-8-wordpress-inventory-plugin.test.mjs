import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-084: WordPress inventory route authenticates, validates, and compensates @spec:AC-084', async () => {
  const source = await readFile(
    new URL('../apps/wordpress-integration/marketplace-inventory.php', import.meta.url),
    'utf8',
  );
  assert.match(source, /current_user_can\('manage_woocommerce'\)/);
  assert.match(source, /wc_get_product/);
  assert.match(source, /count\(\$items\) === 0/);
  assert.match(source, /array_reverse\(\$changed\)/);
  assert.match(source, /wc_update_product_stock\([^;]+, 'increase'\)/s);
});
