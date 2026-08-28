import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { AppModule } from '../apps/wordpress-federation/src/app.module.ts';
import {
  WpGraphqlClientService,
  createWpGraphqlAuth,
  normalizeWordPressSdl,
} from '../libs/wordpress/nest/src/index.ts';

const propagatedIdentity = {
  'x-authenticated-subject': '42',
  'x-authenticated-scopes': 'marketplace:read orders:read cart:write',
  cookie: 'wordpress_session=test',
  'woocommerce-session': 'Session token',
  'cart-token': 'Cart token',
};

test('AC-096: WordPress Federation independently authorizes sensitive operations @spec:AC-096', async () => {
  const now = () => 1_800_000_000_000;
  const auth = createWpGraphqlAuth({
    proxySecret: 'test-only-federation-secret',
    now,
  });

  assert.throws(
    () =>
      auth.headersFor(
        { query: 'query MyOrders { customer { orders { nodes { id } } } }' },
        new Headers({
          'x-authenticated-subject': '42',
          'x-authenticated-scopes': 'marketplace:read',
        }),
      ),
    /orders:read/,
  );
  assert.throws(
    () =>
      auth.headersFor(
        {
          query:
            'mutation Add { addToCart(input: {}) { cart { contents { nodes { key } } } } }',
        },
        new Headers({ 'x-authenticated-scopes': 'cart:write' }),
      ),
    /authenticated subject/i,
  );

  const headers = auth.headersFor(
    { query: 'query MyOrders { customer { orders { nodes { id } } } }' },
    new Headers({
      ...propagatedIdentity,
      'x-authenticated-subject': 'better-auth-user-1',
      'x-wordpress-user-id': '42',
    }),
  );
  assert.equal(headers.get('x-marketplace-subject'), '42');
  assert.equal(
    headers.get('x-marketplace-scopes'),
    'marketplace:read orders:read cart:write',
  );
  assert.equal(headers.get('x-marketplace-timestamp'), '1800000000');
  assert.match(headers.get('x-marketplace-signature'), /^[a-f\d]{64}$/);
  assert.equal(headers.get('cookie'), propagatedIdentity.cookie);

  const plugin = await readFile(
    'apps/wordpress-integration/marketplace-inventory.php',
    'utf8',
  );
  assert.match(plugin, /add_filter\('determine_current_user'/);
  assert.match(plugin, /hash_hmac\('sha256'/);
  assert.match(plugin, /hash_equals\(/);
  assert.match(plugin, /get_user_by\('id'/);
  assert.match(plugin, /better_auth_user_id/);
  assert.match(plugin, /current_user_can\('manage_woocommerce'\)/);
});

test('AC-097: native WordPress plugins provide the delegated commercial graph @spec:AC-097', async () => {
  const requests = [];
  const auth = createWpGraphqlAuth({
    proxySecret: 'test-only-federation-secret',
    now: () => 1_800_000_000_000,
  });
  const client = new WpGraphqlClientService({
    endpoint: 'http://wordpress.test/graphql',
    auth,
    async request(endpoint, init) {
      requests.push({ endpoint: String(endpoint), init });
      return Response.json(
        {
          data: {
            products: {
              nodes: [{ id: 'product-1', name: 'Native Woo product' }],
            },
          },
        },
        { headers: { 'woocommerce-session': 'Rotated session token' } },
      );
    },
  });
  const operation = {
    query: `query Products($first: Int!) {
      products(first: $first) { nodes { id name } }
    }`,
    variables: { first: 10 },
    operationName: 'Products',
  };

  const response = await client.execute(
    operation,
    new Headers(propagatedIdentity),
  );
  assert.deepEqual(await response.json(), {
    data: {
      products: {
        nodes: [{ id: 'product-1', name: 'Native Woo product' }],
      },
    },
  });
  assert.equal(
    response.headers.get('woocommerce-session'),
    'Rotated session token',
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endpoint, 'http://wordpress.test/graphql');
  assert.deepEqual(JSON.parse(requests[0].init.body), operation);
  assert.equal(
    requests[0].init.headers.get('woocommerce-session'),
    propagatedIdentity['woocommerce-session'],
  );
  assert.equal(
    requests[0].init.headers.get('cart-token'),
    propagatedIdentity['cart-token'],
  );

  const nativeSdl = [
    'extend schema @link(url: "https://specs.apollo.dev/federation/v2.11", import: ["@key"])',
    'interface Product { id: ID! }',
    'type SimpleProduct implements Product @key(fields: "id") { id: ID! }',
    'type PageInfo { hasPreviousPage: Boolean! startCursor: String }',
  ].join('\n');
  const normalized = normalizeWordPressSdl(nativeSdl);
  assert.match(normalized, /interface Product @key\(fields: "id"\)/);
  assert.match(normalized, /type SimpleProduct implements Product @key/);
  assert.match(normalized, /import: \["@key", "@inaccessible"\]/);
  assert.match(normalized, /hasPreviousPage: Boolean! @inaccessible/);
  assert.match(normalized, /startCursor: String @inaccessible/);

  const sources = await Promise.all(
    [
      'libs/wordpress/nest/src/federation/wordpress-federation.module.ts',
      'libs/wordpress/nest/src/federation/wpgraphql-client.service.ts',
    ].map((path) => readFile(path, 'utf8')),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /class\s+(?:Product|Cart|Order)(?:Repository|Loader)|wc_get_(?:product|order)|DataLoader/,
  );

  const install = await readFile(
    'apps/wordpress-integration/scripts/install-plugins.sh',
    'utf8',
  );
  assert.match(install, /woocommerce\.10\.4\.3\.zip/);
  assert.match(install, /wp-graphql\.2\.20\.0\.zip/);
  assert.match(install, /wp-graphql-woocommerce\/releases\/download\/v1\.0\.3/);
  assert.match(install, /wp-graphql-federations/);
});

test('AC-098: WordPress Federation replaces Commerce and Stock runtime ownership @spec:AC-098', async () => {
  const delegatedOperations = [];
  const client = new WpGraphqlClientService({
    endpoint: 'http://wordpress.test/graphql',
    auth: createWpGraphqlAuth({
      proxySecret: 'test-only-federation-secret',
      now: () => 1_800_000_000_000,
    }),
    async request(endpoint, init) {
      assert.equal(String(endpoint), 'http://wordpress.test/graphql');
      const operation = JSON.parse(init.body);
      delegatedOperations.push(operation);
      return Response.json(
        operation.query.includes('checkout')
          ? {
              data: {
                checkout: {
                  order: { id: 'order-1', status: 'PROCESSING' },
                },
              },
            }
          : {
              data: {
                product: { id: 'product-1', stockQuantity: 7 },
              },
            },
      );
    },
  });
  const checkout = await client.execute(
    {
      query:
        'mutation Checkout { checkout(input: {}) { order { id status } } }',
    },
    new Headers(propagatedIdentity),
  );
  const inventory = await client.execute(
    { query: 'query Inventory { product(id: "product-1") { stockQuantity } }' },
    new Headers(propagatedIdentity),
  );
  assert.deepEqual(await checkout.json(), {
    data: { checkout: { order: { id: 'order-1', status: 'PROCESSING' } } },
  });
  assert.deepEqual(await inventory.json(), {
    data: { product: { id: 'product-1', stockQuantity: 7 } },
  });
  assert.equal(delegatedOperations.length, 2);

  const appImports = Reflect.getMetadata('imports', AppModule);
  assert.ok(
    appImports.some((entry) => entry.name === 'WordPressFederationModule'),
  );
  assert.equal(Reflect.getMetadata('imports', AppModule).length, 1);

  const appProject = JSON.parse(
    await readFile('apps/wordpress-federation/project.json', 'utf8'),
  );
  const libraryProject = JSON.parse(
    await readFile('libs/wordpress/nest/project.json', 'utf8'),
  );
  assert.deepEqual(appProject.tags, ['type:app', 'scope:wordpress']);
  assert.deepEqual(libraryProject.tags, ['type:lib', 'scope:wordpress']);
  assert.match(
    appProject.targets.test.options.command,
    /wordpress-federation-refactor/,
  );

  const compose = await readFile(
    'apps/wordpress-integration/compose.yaml',
    'utf8',
  );
  assert.match(compose, /^  wordpress-federation:/m);
  assert.doesNotMatch(compose, /^  (?:commerce|stock)(?:-\w+)?:/m);

  const contract = await readFile(
    'libs/contracts/graphql/wordpress/schema.graphql',
    'utf8',
  );
  for (const capability of [
    /interface Product[^\{]*@key\(fields: "id"\)/,
    /type Order[^\{]*@key\(fields: "id"\)/,
    /products\(first: Int, after: String\)/,
    /cart: Cart/,
    /customer: Customer/,
    /addToCart\(input: AddToCartInput!\)/,
    /checkout\(input: CheckoutInput!\)/,
  ]) {
    assert.match(contract, capability);
  }
  assert.doesNotMatch(
    contract,
    /OrderWorkflow|PaymentMethod|CheckoutOperation/,
  );

  assert.equal(Reflect.getMetadata('imports', AppModule).length, 1);
});
