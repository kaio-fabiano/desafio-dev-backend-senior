import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { AuthenticatedDataSource } from '../libs/gateway/nest/src/federation/authenticated-data-source.ts';

const context = {
  authorization: 'Bearer access-token',
  principal: {
    subject: 'buyer-1',
    scopes: ['marketplace:read'],
    audience: ['https://gateway.marketplace.local'],
  },
  requestId: 'request-1',
  sessionHeaders: {
    cookie: 'wordpress_logged_in_secret=value',
    'woocommerce-session': 'session-token',
    'cart-token': 'cart-token',
  },
};

test('AC-121: Gateway remains a thin and secure edge @spec:AC-121', async () => {
  const identity = new AuthenticatedDataSource({
    url: 'http://identity-subgraph:3001/graphql',
  });
  const identityHeaders = new Headers();
  identity.willSendRequest({
    request: { http: { headers: identityHeaders } },
    context,
  });
  assert.equal(identityHeaders.get('cookie'), null);
  assert.equal(identityHeaders.get('woocommerce-session'), null);
  assert.equal(identityHeaders.get('cart-token'), null);

  const reflected = [];
  identity.didReceiveResponse({
    response: {
      http: {
        headers: new Headers({
          'set-cookie': 'wp_woocommerce_session=attacker',
          'cart-token': 'attacker',
        }),
      },
    },
    context: {
      ...context,
      setResponseHeader: (name, value) => reflected.push([name, value]),
    },
  });
  assert.deepEqual(reflected, []);

  const wordpress = new AuthenticatedDataSource({
    url: 'http://wordpress/graphql',
    capabilities: {
      origin: 'http://wordpress',
      requestSession: true,
      responseSession: true,
    },
  });
  const wordpressHeaders = new Headers();
  wordpress.willSendRequest({
    request: { http: { headers: wordpressHeaders } },
    context,
  });
  assert.equal(wordpressHeaders.get('origin'), 'http://wordpress');
  assert.equal(wordpressHeaders.get('cart-token'), 'cart-token');

  const [handler, module] = await Promise.all([
    readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
    readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
  ]);
  assert.match(handler, /source\/gateway-nest/);
  assert.match(module, /case 'wordpress'/);
  await assert.rejects(readFile('apps/gateway/src/auth/token-verifier.ts'));
});
