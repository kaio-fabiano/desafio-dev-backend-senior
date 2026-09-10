import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  gatewayModule,
  identityModule,
  identityFactory,
  resourceModule,
  readme,
  prd,
  presentation,
] = await Promise.all(
  [
    '../libs/gateway/nest/src/auth/gateway-auth.module.ts',
    '../libs/identity/nest/src/identity.module.ts',
    '../libs/identity/nest/src/better-auth/better-auth.factory.ts',
    '../libs/platform/nest/src/oauth-resource/oauth-resource.module.ts',
    '../README.md',
    '../docs/prds/03-identidade-e-oauth.md',
    '../docs/evidence/harden-oauth-runtime-configuration/presentation.md',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
);

test('OAuth providers share an HTTP issuer default and resolve Nest configuration lazily @spec:AC-305', () => {
  const issuer = /['"]http:\/\/identity-subgraph:3001\/api\/auth['"]/;

  assert.match(gatewayModule, /OAuthResourceModule\.registerAsync\(/);
  assert.match(identityModule, /OAuthResourceModule\.registerAsync\(/);
  assert.match(resourceModule, /static registerAsync\(/);
  assert.match(gatewayModule, issuer);
  assert.match(identityModule, issuer);
  assert.match(identityFactory, issuer);
  assert.doesNotMatch(gatewayModule, /process\.env\./);
  assert.doesNotMatch(identityModule, /process\.env\./);
});

test('documents federated audiences and DPoP presentation guidance @spec:AC-313', () => {
  for (const source of [readme, prd, presentation]) {
    const document = source.replaceAll(/\s+/g, ' ');
    assert.match(
      document,
      /Gateway-only operations? (?:use|require) the Gateway audience/i,
    );
    assert.match(
      document,
      /Gateway-to-Identity federated[^.]*\brequire the Identity audience/i,
    );
    assert.match(document, /Bearer OAuth is delivered/i);
    assert.match(
      document,
      /DPoP[\s\S]*canonical\s+external\s+Gateway\s+origin[\s\S]*shared\s+replay\s+store/i,
    );
    assert.match(document, /htu[^.]*effective request URI/i);
    assert.match(document, /htm[^.]*method/i);
    assert.match(document, /(?:jti[^.]*replay|replay[^.]*jti)[^.]*reject/i);
  }
  assert.match(presentation, /users` requires `identity:users:read`/i);
  assert.match(
    presentation,
    /user\(id\)[^.]*self[^.]*admin[^.]*cross-user reads return `null`/i,
  );
  assert.match(presentation, /production[^.]*provider is tested/i);
  assert.match(presentation, /legacy aliases (?:removed|are removed)/i);
  assert.match(presentation, /hasPreviousPage[^.]*persisted rows/i);
  assert.match(presentation, /T-273[^.]*resolved/i);
});
