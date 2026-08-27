import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createWooOrderAdapter } from '../../commerce-subgraph/src/checkout/woo-order.adapter.ts';

const endpoint = process.env.WORDPRESS_URL ?? 'http://localhost:18080';
const composeFile = fileURLToPath(new URL('../compose.yaml', import.meta.url));
const reference = `checkout-probe-${randomUUID()}`;
const applicationName = reference;

function wp(...arguments_) {
  return execFileSync(
    'docker',
    [
      'compose',
      '--file',
      composeFile,
      'run',
      '--rm',
      '--no-deps',
      'cli',
      'wp',
      ...arguments_,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

const applicationPassword = wp(
  'user',
  'application-password',
  'create',
  'admin',
  applicationName,
  '--porcelain',
);
const application = JSON.parse(
  wp(
    'user',
    'application-password',
    'list',
    'admin',
    '--fields=uuid,name',
    '--format=json',
  ),
).find(({ name }) => name === applicationName);
assert.ok(
  application?.uuid,
  'temporary WordPress application password was not found',
);

let orderId;
try {
  wp('config', 'set', 'WP_ENVIRONMENT_TYPE', 'local', '--raw');
  const productId = Number(
    wp(
      'post',
      'list',
      '--post_type=product',
      '--posts_per_page=1',
      '--field=ID',
    ),
  );
  assert.ok(
    Number.isSafeInteger(productId),
    'the pinned WooCommerce fixture has no product',
  );
  const adapter = createWooOrderAdapter({
    endpoint,
    consumerKey: 'admin',
    consumerSecret: applicationPassword,
  });
  const command = {
    reference,
    order: {
      payment_method: 'cod',
      line_items: [{ product_id: productId, quantity: 1 }],
    },
  };
  const first = await adapter.createOrFind(command);
  const retry = await adapter.createOrFind(command);
  const reconciled = await adapter.findByReference(reference);
  orderId = first.id;

  assert.equal(retry.id, first.id);
  assert.equal(reconciled?.id, first.id);
  console.log(
    JSON.stringify({ reference, orderId, retriesCreatedOneOrder: true }),
  );
} finally {
  try {
    if (orderId) {
      const authorization = `Basic ${Buffer.from(`admin:${applicationPassword}`).toString('base64')}`;
      const deleted = await fetch(
        `${endpoint}/wp-json/wc/v3/orders/${orderId}?force=true`,
        {
          method: 'DELETE',
          headers: { authorization },
        },
      );
      assert.equal(
        deleted.ok,
        true,
        `temporary WooCommerce order cleanup failed: ${deleted.status}`,
      );
    }
  } finally {
    wp('user', 'application-password', 'delete', 'admin', application.uuid);
  }
}
