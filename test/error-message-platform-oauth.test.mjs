import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { OAuthCredentialError } from '../libs/platform/nest/src/oauth-resource/domain/errors/oauth-credential.error.ts';
import { OAuthClaims } from '../libs/platform/nest/src/oauth-resource/domain/value-objects/oauth-claims.ts';
import { OAuthAuthenticationMessages } from '../libs/platform/nest/src/oauth-resource/presentation/graphql/oauth-authentication-messages.ts';
import { OAuthRequestAdapter } from '../libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts';
import { OAuthResourceService } from '../libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts';

const sourceRoot = new URL('../libs/platform/nest/src/', import.meta.url);

test('AC-298: Platform OAuth TypeScript throw sites use named messages @spec:AC-298', async () => {
  const files = (await readdir(sourceRoot, { recursive: true })).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
  );
  const violations = [];

  for (const file of files) {
    const source = await readFile(new URL(file, sourceRoot), 'utf8');
    for (const match of source.matchAll(
      /throw\s+new\s+[\w.]+\s*\(\s*([\s\S]*?)\s*\);/g,
    )) {
      if (!/^[A-Z]\w*Messages\.\w+(?:\([\s\S]*\))?,?$/.test(match[1])) {
        violations.push(`${file}: ${match[0].replaceAll(/\s+/g, ' ')}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('AC-300: OAuthCredentialError supplies its documented default message @spec:AC-300', () => {
  assert.equal(new OAuthCredentialError().message, 'Invalid OAuth credential');
});

test('AC-301: Platform OAuth observable error text remains compatible @spec:AC-301', () => {
  assert.throws(
    () => OAuthClaims.from({ sub: '' }),
    /Access token subject must be a non-empty string/,
  );
  assert.throws(
    () => OAuthClaims.from({ scope: 42, sub: 'buyer-1' }),
    /Access token scope must be a string/,
  );
  assert.throws(
    () => OAuthRequestAdapter.toRequest({ headers: {}, protocol: 'ftp' }),
    /OAuth request protocol must be HTTP or HTTPS/,
  );
  assert.throws(
    () =>
      OAuthRequestAdapter.toRequest({
        headers: {},
        originalUrl: 'https://attacker.example',
      }),
    /OAuth request target must be an absolute path/,
  );
  assert.throws(
    () =>
      new OAuthResourceService({
        audience: 'ftp://gateway',
        issuer: 'identity',
        jwksUrl: 'jwks',
      }),
    /OAuth audience must be a valid URL/,
  );
  assert.deepEqual(
    {
      authenticatedSubjectRequired:
        OAuthAuthenticationMessages.authenticatedSubjectRequired,
      bearerTokenRequired: OAuthAuthenticationMessages.bearerTokenRequired,
      invalidBearerToken: OAuthAuthenticationMessages.invalidBearerToken,
      requiredScopeMissing: OAuthAuthenticationMessages.requiredScopeMissing,
    },
    {
      authenticatedSubjectRequired: 'Authenticated subject is required',
      bearerTokenRequired: 'Bearer token required',
      invalidBearerToken: 'Invalid bearer token',
      requiredScopeMissing: 'Required OAuth scope is missing',
    },
  );
});
