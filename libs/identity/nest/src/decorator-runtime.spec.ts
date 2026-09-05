import { describe, expect, it } from 'vitest';

import { IdentityModule } from './identity.module.ts';

describe('Identity Nest decorator runtime', () => {
  it('loads module metadata in Vitest @spec:AC-225', () => {
    expect(Reflect.getMetadataKeys(IdentityModule)).not.toEqual([]);
  });
});
