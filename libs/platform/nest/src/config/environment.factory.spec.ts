import { describe, expect, it } from 'vitest';

import { environmentFactory } from './environment.factory.ts';

describe('environmentFactory', () => {
  it('returns an immutable snapshot instead of the mutable source object', () => {
    const source = { PORT: '3000' };

    const environment = environmentFactory(source);
    source.PORT = '4000';

    expect(environment).toEqual({ PORT: '3000' });
    expect(Object.isFrozen(environment)).toBe(true);
  });

  it('preserves undefined values from a process environment contract', () => {
    const environment = environmentFactory({ OPTIONAL_VALUE: undefined });

    expect(environment).toHaveProperty('OPTIONAL_VALUE', undefined);
  });
});
