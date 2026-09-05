import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const endpoint =
  process.env.WORDPRESS_GRAPHQL_URL ?? 'http://localhost:18080/graphql';
const siteToken = process.env.WPGRAPHQL_SITE_TOKEN ?? 'wordpress-local-only';
const registrarIdentity = 'identity-registrar';
const composeFile = fileURLToPath(new URL('../compose.yaml', import.meta.url));
const username = `identity-poc-${randomUUID()}`;
const email = `${username}@example.test`;
const subject = `better-auth-${randomUUID()}`;

function wp(args, options = {}) {
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
      ...args,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options },
  ).trim();
}

function ensureRegistrar() {
  try {
    wp(['role', 'create', 'identity_registrar', 'Identity Registrar']);
  } catch {
    // The role is persistent and the probe is intentionally repeatable.
  }
  for (const capability of [
    'read',
    'list_users',
    'edit_users',
    'delete_users',
  ]) {
    wp(['cap', 'add', 'identity_registrar', capability]);
  }
  try {
    wp(['user', 'get', registrarIdentity]);
  } catch {
    wp([
      'user',
      'create',
      registrarIdentity,
      'identity-registrar@example.test',
      '--role=identity_registrar',
      '--user_pass=unused-local-only',
    ]);
  }
  wp([
    'user',
    'meta',
    'update',
    registrarIdentity,
    'better_auth_user_id',
    registrarIdentity,
  ]);
}

async function graphql(operation, variables = {}, authorization) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(endpoint).origin,
      'x-wpgraphql-site-token': siteToken,
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    },
    body: JSON.stringify({ query: operation, variables }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

ensureRegistrar();
let customerId;
let deleted = false;
try {
  const registered = await graphql(
    `
      mutation RegisterIdentityCustomer($input: RegisterCustomerInput!) {
        registerCustomer(input: $input) {
          customer {
            id
          }
        }
      }
    `,
    {
      input: {
        authenticate: false,
        email,
        firstName: 'Registration',
        password: 'Registration-poc-2026!',
        username,
      },
    },
  );
  assert.equal(registered.errors, undefined, JSON.stringify(registered.errors));
  customerId = registered.data?.registerCustomer?.customer?.id;
  assert.ok(customerId);

  const registrar = await graphql(
    `
      mutation LoginIdentityRegistrar($input: LoginInput!) {
        login(input: $input) {
          authToken
        }
      }
    `,
    { input: { identity: registrarIdentity, provider: 'SITETOKEN' } },
  );
  assert.equal(registrar.errors, undefined, JSON.stringify(registrar.errors));
  const authToken = registrar.data?.login?.authToken;
  assert.ok(authToken);

  const linked = await graphql(
    `
      mutation LinkIdentitySubject($input: UpdateCustomerInput!) {
        updateCustomer(input: $input) {
          customer {
            id
            metaData(keysIn: ["better_auth_user_id"]) {
              key
              value
            }
          }
        }
      }
    `,
    {
      input: {
        id: customerId,
        metaData: [{ key: 'better_auth_user_id', value: subject }],
      },
    },
    authToken,
  );
  assert.equal(linked.errors, undefined, JSON.stringify(linked.errors));
  assert.deepEqual(linked.data.updateCustomer.customer.metaData, [
    { key: 'better_auth_user_id', value: subject },
  ]);

  const linkedLogin = await graphql(
    `
      mutation LoginLinkedIdentity($input: LoginInput!) {
        login(input: $input) {
          customer {
            id
          }
        }
      }
    `,
    { input: { identity: subject, provider: 'SITETOKEN' } },
  );
  assert.equal(
    linkedLogin.errors,
    undefined,
    JSON.stringify(linkedLogin.errors),
  );
  assert.equal(linkedLogin.data.login.customer.id, customerId);

  const removed = await graphql(
    `
      mutation DeleteIdentityCustomer($input: DeleteUserInput!) {
        deleteUser(input: $input) {
          deletedId
        }
      }
    `,
    { input: { id: customerId } },
    authToken,
  );
  assert.equal(removed.errors, undefined, JSON.stringify(removed.errors));
  assert.equal(removed.data.deleteUser.deletedId, customerId);
  deleted = true;

  console.log(
    JSON.stringify({
      authentication: {
        mechanism: 'WPGraphQL Headless Login SITETOKEN',
        registrarCapabilities: [
          'read',
          'list_users',
          'edit_users',
          'delete_users',
        ],
      },
      capabilities: {
        createCustomer: true,
        deleteCustomer: true,
        linkSubject: true,
      },
      customSchemaRequired: false,
      operations: [
        'RegisterIdentityCustomer',
        'LoginIdentityRegistrar',
        'LinkIdentitySubject',
        'LoginLinkedIdentity',
        'DeleteIdentityCustomer',
      ],
    }),
  );
} finally {
  if (customerId && !deleted) {
    try {
      wp(['user', 'delete', username, '--yes']);
    } catch {
      // Preserve the original proof failure; the disposable PoC can be reset.
    }
  }
}
