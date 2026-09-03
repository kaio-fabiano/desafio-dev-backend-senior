import { describe, expect, it } from 'vitest';

import {
  upsertEnvironmentValue,
  validateSandboxClaims,
} from './sandbox-bearer.ts';

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
});
