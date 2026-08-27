import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IdentityResolver } from '../apps/identity-subgraph/src/graphql/identity.resolver.ts';
import { verifyGatewayRequest } from '../apps/gateway/src/auth/token-verifier.ts';

const issuer = 'https://identity.marketplace.test/api/auth';
const audience = 'https://gateway.marketplace.local';
const now = 2_000_000_000;
const validClaims = {
  sub: 'user-a',
  iss: issuer,
  aud: audience,
  exp: now + 60,
  scope: 'openid marketplace:read',
};
const request = new Request('https://gateway.marketplace.test/graphql', {
  headers: { authorization: 'Bearer token', 'x-user-id': 'user-b' },
});

function verify(claims) {
  return verifyGatewayRequest(request, {
    issuer,
    audience,
    requiredScopes: ['marketplace:read'],
    now: () => now * 1000,
    verify: async () => claims,
  });
}

test('AC-025: Invalid token claims are rejected @spec:AC-025', async () => {
  const invalid = [
    { ...validClaims, exp: now - 1 },
    { ...validClaims, iss: 'https://attacker.test' },
    { ...validClaims, aud: 'https://wrong-resource.test' },
    { ...validClaims, scope: 'openid' },
  ];
  for (const claims of invalid) await assert.rejects(verify(claims));
  await assert.rejects(
    verifyGatewayRequest(request, {
      issuer,
      audience,
      requiredScopes: ['marketplace:read'],
      verify: async () => {
        throw new Error('Invalid signature');
      },
    }),
  );
});

test('AC-026: A valid token resolves me @spec:AC-026', async () => {
  const context = await verify(validClaims);
  const resolver = new IdentityResolver(async (id) =>
    id === 'user-a' ? { id, email: 'a@example.test' } : null,
  );
  assert.deepEqual(await resolver.me(context), {
    id: 'user-a',
    email: 'a@example.test',
  });
});

test('AC-027: Caller input cannot replace the authenticated user @spec:AC-027', async () => {
  const context = await verify(validClaims);
  const lookedUp = [];
  const resolver = new IdentityResolver(async (id) => {
    lookedUp.push(id);
    return { id, email: `${id}@example.test` };
  });
  const result = await resolver.me(context, { userId: 'user-b' });
  assert.equal(result.id, 'user-a');
  assert.deepEqual(lookedUp, ['user-a']);
});
