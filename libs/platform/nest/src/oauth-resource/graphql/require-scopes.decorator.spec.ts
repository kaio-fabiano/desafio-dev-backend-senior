import { describe, expect, it } from 'vitest';

import { RequireScopes } from './require-scopes.decorator.ts';

describe('RequireScopes', () => {
  it('stores the required scopes as NestJS metadata', () => {
    class Resolver {
      operation(): boolean {
        return true;
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      Resolver.prototype,
      'operation',
    );
    expect(descriptor).toBeDefined();
    RequireScopes('orders:read', 'cart:write')(
      Resolver.prototype,
      'operation',
      descriptor as PropertyDescriptor,
    );

    const values = Reflect.getMetadataKeys(Resolver.prototype.operation).map(
      (key) => Reflect.getMetadata(key, Resolver.prototype.operation),
    );
    expect(values).toContainEqual(['orders:read', 'cart:write']);
  });
});
