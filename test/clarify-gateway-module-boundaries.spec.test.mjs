import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-245: authentication has a focused NestJS module @spec:AC-245', async () => {
  const [authModule, gatewayModule, barrel] = await Promise.all([
    readFile('libs/gateway/nest/src/auth/gateway-auth.module.ts', 'utf8'),
    readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
    readFile('libs/gateway/nest/src/index.ts', 'utf8'),
  ]);

  assert.match(authModule, /export class GatewayAuthModule/);
  assert.match(authModule, /OAuthResourceModule\.register/);
  assert.match(
    authModule,
    /providers: \[TokenVerifierService, AuthContextFactory\]/,
  );
  assert.match(
    authModule,
    /exports: \[TokenVerifierService, AuthContextFactory\]/,
  );

  assert.match(gatewayModule, /imports: \[GatewayAuthModule\]/);
  assert.match(gatewayModule, /exports: \[GatewayAuthModule\]/);
  assert.doesNotMatch(gatewayModule, /OAuthResourceModule/);
  assert.doesNotMatch(gatewayModule, /GatewayAuthProvidersModule/);
  assert.equal((gatewayModule.match(/@Module\(/g) ?? []).length, 1);

  assert.match(
    barrel,
    /export \{ GatewayAuthModule \} from '\.\/auth\/gateway-auth\.module\.ts';/,
  );
  assert.match(
    barrel,
    /export \{ GatewayModule \} from '\.\/gateway\.module\.ts';/,
  );
});
