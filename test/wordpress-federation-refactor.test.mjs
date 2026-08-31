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
  const exchanges = [];
  const auth = createWpGraphqlAuth({
    endpoint: 'http://wordpress.test/graphql',
    siteToken: 'test-only-site-token',
    request: async (endpoint, init) => {
      exchanges.push({ endpoint: String(endpoint), init });
      return Response.json({
        data: {
          login: { authToken: 'wordpress-jwt', wooSessionToken: 'woo-jwt' },
        },
      });
    },
  });

  await assert.rejects(
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
  await assert.rejects(
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
  await assert.rejects(
    () =>
      auth.headersFor(
        {
          query:
            'mutation Pay($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id } } }',
          variables: { input: { id: 'order-1', isPaid: true } },
        },
        new Headers(propagatedIdentity),
      ),
    /orders:write/,
  );

  const serviceHeaders = await auth.headersFor(
    {
      query:
        'mutation Reserve($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id } } }',
      variables: { input: { id: 'order-1', status: 'PROCESSING' } },
    },
    new Headers({
      'x-authenticated-subject': 'payment-federation',
      'x-authenticated-scopes': 'orders:write',
    }),
  );
  assert.equal(serviceHeaders.get('authorization'), 'Bearer wordpress-jwt');

  const headers = await auth.headersFor(
    { query: 'query MyOrders { customer { orders { nodes { id } } } }' },
    new Headers({
      ...propagatedIdentity,
      'x-authenticated-subject': 'better-auth-user-1',
    }),
  );
  assert.equal(headers.get('authorization'), 'Bearer wordpress-jwt');
  assert.equal(headers.get('woocommerce-session'), 'Session woo-jwt');
  assert.equal(headers.get('cookie'), propagatedIdentity.cookie);
  assert.equal(exchanges.length, 2);
  assert.equal(
    exchanges[1].init.headers['x-wpgraphql-site-token'],
    'test-only-site-token',
  );
  assert.equal(
    JSON.parse(exchanges[1].init.body).variables.identity,
    'better-auth-user-1',
  );
});

test('AC-097: native WordPress plugins provide the delegated commercial graph @spec:AC-097', async () => {
  const requests = [];
  const auth = createWpGraphqlAuth({
    endpoint: 'http://wordpress.test/graphql',
    siteToken: 'test-only-site-token',
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

  const response = await client.execute(operation, new Headers());
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
  assert.equal(requests[0].init.headers.get('woocommerce-session'), null);
  assert.equal(requests[0].init.headers.get('cart-token'), null);

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
  assert.match(install, /wp-graphql-headless-login/);
});

test('AC-098: WordPress Federation replaces Commerce and Stock runtime ownership @spec:AC-098', async () => {
  const delegatedOperations = [];
  const client = new WpGraphqlClientService({
    endpoint: 'http://wordpress.test/graphql',
    auth: createWpGraphqlAuth({
      endpoint: 'http://wordpress.test/graphql',
      siteToken: 'test-only-site-token',
      request: async () =>
        Response.json({ data: { login: { authToken: 'wordpress-jwt' } } }),
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
