import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(
  root,
  'libs/identity/nest/src/application/errors/identity-error-messages.ts',
);
const sourceRoots = [
  join(root, 'apps/identity-subgraph/src'),
  join(root, 'libs/identity/nest/src'),
];

const productionSources = ts.sys
  .readDirectory(sourceRoots[0], ['.ts'], undefined, undefined)
  .concat(ts.sys.readDirectory(sourceRoots[1], ['.ts'], undefined, undefined))
  .filter((path) => !path.endsWith('.spec.ts'));

const messageArgument = (expression) => {
  const name = expression.expression.getText();
  if (
    [
      'BetterAuthError',
      'OAuthError',
      'RegistrationError',
      'WordPressError',
    ].includes(name)
  ) {
    return expression.arguments[1];
  }
  if (name === 'APIError') {
    const options = expression.arguments[1];
    return options?.properties?.find(
      (property) => property.name?.getText() === 'message',
    )?.initializer;
  }
  return expression.arguments[0];
};

const inlineMessage = (expression) =>
  ts.isStringLiteral(expression) ||
  ts.isNoSubstitutionTemplateLiteral(expression) ||
  ts.isTemplateExpression(expression);

test('Identity TypeScript throw sites use named messages @spec:AC-298', () => {
  const violations = [];
  for (const path of productionSources) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      if (
        ts.isThrowStatement(node) &&
        node.expression &&
        ts.isNewExpression(node.expression)
      ) {
        const message = messageArgument(node.expression);
        if (!message || inlineMessage(message)) {
          const { line } = source.getLineAndCharacterOfPosition(
            node.getStart(),
          );
          violations.push(`${relative(root, path)}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.deepEqual(violations, []);
});

test('Identity custom exceptions provide documented messages @spec:AC-300', async () => {
  assert.ok(existsSync(catalogPath), 'Identity error catalog is missing');
  const [
    { BetterAuthError },
    { OAuthError },
    { RegistrationError },
    { WordPressError },
  ] = await Promise.all([
    importSource('better-auth/better-auth.error.ts'),
    importSource('application/errors/oauth.error.ts'),
    importSource('application/errors/registration.error.ts'),
    importSource('wordpress/wordpress.error.ts'),
  ]);

  assert.equal(
    new BetterAuthError('BETTER_AUTH_SECRET_REQUIRED').message,
    'BETTER_AUTH_SECRET is required in production',
  );
  assert.equal(
    new OAuthError('OAUTH_CLIENTS_NOT_READY').message,
    'Identity OAuth clients are not ready',
  );
  assert.equal(
    new RegistrationError('REGISTRATION_COMPENSATION_FAILED').message,
    'Registration failed and compensation was incomplete',
  );
  assert.equal(
    new WordPressError('WORDPRESS_LINK_FAILED').message,
    'WordPress identity link failed',
  );
});

test('Identity observable error text remains compatible @spec:AC-301', async () => {
  assert.ok(existsSync(catalogPath), 'Identity error catalog is missing');
  const { IdentityErrorMessages } = await import(pathToFileURL(catalogPath));

  assert.deepEqual(
    {
      ...IdentityErrorMessages.betterAuth,
      ...IdentityErrorMessages.oauth,
      ...IdentityErrorMessages.registration,
      ...IdentityErrorMessages.wordpress,
      healthNotReady: IdentityErrorMessages.healthNotReady,
      invalidUserCursor: IdentityErrorMessages.invalidUserCursor,
      invalidUserPageSize: IdentityErrorMessages.invalidUserPageSize,
      oauthSeed401: IdentityErrorMessages.oauthClientSeedFailed(401),
    },
    {
      BETTER_AUTH_SECRET_REQUIRED:
        'BETTER_AUTH_SECRET is required in production',
      OAUTH_CLIENT_SEED_FAILED: 'Identity client seed failed',
      OAUTH_CLIENTS_NOT_READY: 'Identity OAuth clients are not ready',
      SEED_ADMIN_PASSWORD_REQUIRED:
        'SEED_ADMIN_PASSWORD is required to create OAuth clients',
      IDENTITY_ACCOUNT_ADAPTER_REQUIRED: 'Identity account adapter is required',
      REGISTRATION_COMPENSATION_FAILED:
        'Registration failed and compensation was incomplete',
      REGISTRATION_COULD_NOT_BE_COMPLETED:
        'Registration could not be completed',
      WORDPRESS_CONFIGURATION_INVALID:
        'WPGRAPHQL_SITE_TOKEN is required in production',
      WORDPRESS_CREATE_FAILED: 'WordPress identity creation failed',
      WORDPRESS_CREATE_RETURNED_NO_CUSTOMER:
        'WordPress identity creation returned no customer',
      WORDPRESS_DELETE_FAILED: 'WordPress identity rollback failed',
      WORDPRESS_IDENTITY_ALREADY_EXISTS: 'WordPress identity already exists',
      WORDPRESS_LINK_FAILED: 'WordPress identity link failed',
      WORDPRESS_REGISTRAR_AUTHENTICATION_FAILED:
        'WordPress registrar authentication failed',
      healthNotReady: 'Service Unavailable',
      invalidUserCursor: 'Invalid user cursor',
      invalidUserPageSize: 'first must be between 1 and 100',
      oauthSeed401: 'Identity client seed failed: 401',
    },
  );
});

function importSource(path) {
  return import(pathToFileURL(join(root, 'libs/identity/nest/src', path)));
}
