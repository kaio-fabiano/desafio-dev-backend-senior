import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createIdentityAuth } from '../apps/identity-subgraph/src/auth/config.ts';
import { createRegistrationHandler } from '../apps/identity-subgraph/src/registration/registration-handler.ts';
import {
  RegistrationIncompleteError,
  signUpUser,
} from '../apps/identity-subgraph/src/registration/sign-up-user.ts';
import { createWordPressIdentityAdapter } from '../apps/identity-subgraph/src/registration/wordpress-identity.adapter.ts';

function identityStore({ canDelete = true } = {}) {
  const state = { accounts: ['email'], deleted: false, disabled: false };
  return {
    state,
    async createEmailIdentity() {
      return { id: 'user-1' };
    },
    async linkAccount(_userId, account) {
      state.accounts.push(account.providerId);
    },
    async deleteIdentity() {
      state.deleted = canDelete;
      return canDelete;
    },
    async disableIdentity() {
      state.disabled = true;
    },
  };
}

const input = {
  email: 'new@example.test',
  password: 'a-long-test-password',
  name: 'New User',
};

async function runtimeRegistration(wordpress) {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthAuthorizationCode: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
  };
  const auth = createIdentityAuth(memoryAdapter(database), {
    baseURL: 'http://identity.test',
    secret: 'registration-test-secret-at-least-32-characters',
    seedAdminEmail: 'admin@identity.test',
  });
  const register = createRegistrationHandler(auth, wordpress);
  const response = await register(
    new Request('http://identity.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { auth, database, response };
}

test('AC-028: Registration links email and WordPress accounts @spec:AC-028', async () => {
  const identity = identityStore();
  const result = await signUpUser(input, identity, {
    async createOrLink() {
      return { id: 'wp-10' };
    },
  });
  assert.deepEqual(result.accounts, ['email', 'wordpress']);
  assert.deepEqual(identity.state.accounts, ['email', 'wordpress']);
});

test('AC-029: A failed WordPress link leaves no usable partial account @spec:AC-029', async () => {
  for (const canDelete of [true, false]) {
    const identity = identityStore({ canDelete });
    await assert.rejects(
      signUpUser(input, identity, {
        async createOrLink() {
          throw new Error('WordPress unavailable');
        },
      }),
      RegistrationIncompleteError,
    );
    assert.equal(identity.state.deleted || identity.state.disabled, true);
  }
});

test('AC-028: public Better Auth sign-up persists the WordPress provider account @spec:AC-028', async () => {
  const { auth, response } = await runtimeRegistration({
    async createOrLink() {
      return { id: 'wp-44' };
    },
  });

  assert.equal(response.status, 200);
  const registered = await response.clone().json();
  const account = await (
    await auth.$context
  ).adapter.findOne({
    model: 'account',
    where: [
      { field: 'userId', value: registered.user.id },
      { field: 'providerId', value: 'wordpress' },
    ],
  });
  assert.equal(account.accountId, 'wp-44');
});

test('AC-029: public sign-up revokes the Better Auth identity when WordPress fails @spec:AC-029', async () => {
  const { database, response } = await runtimeRegistration({
    async createOrLink() {
      throw new Error('WordPress unavailable');
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(database.user, []);
  assert.deepEqual(database.session, []);
  assert.deepEqual(database.account, []);
});

test('WordPress identity uses authenticated public REST and links an existing customer', async () => {
  const requests = [];
  const wordpress = createWordPressIdentityAdapter({
    endpoint: 'http://wordpress.test',
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    async request(url, init) {
      requests.push({ url: String(url), init });
      return Response.json([{ id: 42 }]);
    },
  });

  assert.deepEqual(await wordpress.createOrLink(input), { id: '42' });
  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.pathname, '/wp-json/wc/v3/customers');
  assert.equal(requestUrl.searchParams.get('email'), input.email);
  assert.equal(requestUrl.searchParams.get('consumer_key'), 'consumer-key');
  assert.equal(
    requestUrl.searchParams.get('consumer_secret'),
    'consumer-secret',
  );
});

test('WordPress identity creates a customer only when the email is absent', async () => {
  const methods = [];
  let createdBody;
  const wordpress = createWordPressIdentityAdapter({
    endpoint: 'http://wordpress.test',
    consumerKey: 'consumer-key',
    consumerSecret: 'consumer-secret',
    async request(_url, init) {
      methods.push(init.method ?? 'GET');
      if (init.body) createdBody = JSON.parse(init.body);
      return methods.length === 1
        ? Response.json([])
        : Response.json({ id: 43 });
    },
  });

  assert.deepEqual(await wordpress.createOrLink(input), { id: '43' });
  assert.deepEqual(methods, ['GET', 'POST']);
  assert.deepEqual(createdBody, {
    email: input.email,
    first_name: input.name,
    password: input.password,
  });
});
