import { describe, expect, it } from 'vitest';

import {
  isApprovedIdentityUrl,
  upsertEnvironmentValue,
  validateSandboxClaims,
} from './sandbox-bearer.ts';
import { classifyAuthorizationResult } from './journey.ts';

describe('sandbox bearer utility', () => {
  it('AC-189: replaces the local bearer without disclosing or duplicating it @spec:AC-189', () => {
    const updated = upsertEnvironmentValue(
      'SAFE=value\nMERCADO_PAGO_SANDBOX_BEARER_TOKEN=old\n',
      'MERCADO_PAGO_SANDBOX_BEARER_TOKEN',
      'new-secret',
    );

    expect(updated).toBe(
      'SAFE=value\nMERCADO_PAGO_SANDBOX_BEARER_TOKEN=new-secret\n',
    );
  });

  it('rejects a grant without every required sandbox scope', () => {
    expect(() => validateSandboxClaims({ scope: 'cart:write' })).toThrow(
      'orders:read',
    );
    expect(() =>
      validateSandboxClaims({ scope: 'cart:write orders:read' }),
    ).not.toThrow();
  });

  it('accepts deployed HTTPS and local loopback Identity URLs only', () => {
    expect(
      isApprovedIdentityUrl(
        'https://example.execute-api.us-east-1.amazonaws.com',
      ),
    ).toBe(true);
    expect(isApprovedIdentityUrl('http://127.0.0.1:3001')).toBe(true);
    expect(isApprovedIdentityUrl('http://example.com')).toBe(false);
  });

  it('reports OAuth redirect errors before attempting consent', () => {
    expect(() =>
      classifyAuthorizationResult(
        '/oauth/callback?error=invalid_client&error_description=client_id+is+required',
        'https://identity.example.test',
      ),
    ).toThrow('invalid_client (client_id is required)');
  });
});
