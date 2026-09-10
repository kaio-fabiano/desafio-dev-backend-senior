import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [gatewayModule, identityModule, identityFactory, resourceModule] =
  await Promise.all(
    [
      '../libs/gateway/nest/src/auth/gateway-auth.module.ts',
      '../libs/identity/nest/src/identity.module.ts',
      '../libs/identity/nest/src/better-auth/better-auth.factory.ts',
      '../libs/platform/nest/src/oauth-resource/oauth-resource.module.ts',
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
