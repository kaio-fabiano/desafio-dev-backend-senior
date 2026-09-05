import { Scope, type InjectionToken, type Provider } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PersistenceModule } from './persistence.module.ts';
import {
  ORDER_WORKFLOW_ENTITY_MANAGER,
  ORDER_WORKFLOW_ORM,
} from './persistence.tokens.ts';

const mikroOrm = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock('@mikro-orm/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mikro-orm/core')>()),
  MikroORM: { init: mikroOrm.init },
}));

describe('PersistenceModule', () => {
  it('owns and exports the ORM and request EntityManager providers', () => {
    const providers = Reflect.getMetadata(
      'providers',
      PersistenceModule,
    ) as Provider[];
    const exports = Reflect.getMetadata(
      'exports',
      PersistenceModule,
    ) as unknown[];
    const provider = (token: InjectionToken) => {
      const match = providers.find(
        (candidate) =>
          typeof candidate === 'object' && candidate.provide === token,
      );
      if (!match || !('useFactory' in match)) {
        throw new Error(`Missing factory for ${String(token)}`);
      }
      return match;
    };
    const fork = vi.fn().mockReturnValue('request-entity-manager');

    expect(provider(ORDER_WORKFLOW_ENTITY_MANAGER).scope).toBe(Scope.REQUEST);
    expect(
      provider(ORDER_WORKFLOW_ENTITY_MANAGER).useFactory({
        em: { fork },
      } as never),
    ).toBe('request-entity-manager');
    expect(exports).toEqual(
      expect.arrayContaining([
        ORDER_WORKFLOW_ORM,
        ORDER_WORKFLOW_ENTITY_MANAGER,
      ]),
    );

    const initialized = Promise.resolve({ em: { fork } });
    mikroOrm.init.mockReturnValue(initialized);
    expect(provider(ORDER_WORKFLOW_ORM).useFactory()).toBe(initialized);
  });
});
