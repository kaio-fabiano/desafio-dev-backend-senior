import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { OAuthGraphQLContext } from '@desafio-dev-backend-senior/source/platform-nest';
import { FindIdentityUsersUseCase } from '../application/use-cases/find-identity-users.use-case.ts';
import { IdentityResolver } from './identity.resolver.ts';

function context(
  subject: string,
  scopes: readonly string[],
): OAuthGraphQLContext {
  return {
    auth: { audience: [], claims: {}, scopes, subject },
  };
}

describe('IdentityResolver', () => {
  it('rejects malformed Relay cursors before querying Better Auth @spec:AC-228', async () => {
    const users = {
      findPage: vi.fn(),
    };
    const resolver = new IdentityResolver(users as never, {} as never);

    await expect(resolver.users(20, 'not a cursor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(resolver.users(20, 'a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.findPage).not.toHaveBeenCalled();
  });

  it('maps pages and batches repeated user references per request @spec:AC-228', async () => {
    const findByIds = vi
      .fn()
      .mockResolvedValue([{ id: 'one', email: 'one@test' }]);
    const findPage = vi.fn().mockResolvedValue({
      edges: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    });
    const repository = { findByIds, findPage };
    const usersById = new FindIdentityUsersUseCase(repository);
    const resolver = new IdentityResolver(repository, usersById);

    await expect(resolver.users(0)).rejects.toBeInstanceOf(BadRequestException);
    await resolver.users(1);
    await resolver.users(1, Buffer.from('after').toString('base64url'));
    const [first, repeated] = await Promise.all([
      resolver.user('one', context('one', ['marketplace:read'])),
      resolver.user('one', context('one', ['marketplace:read'])),
    ]);
    expect(first).toEqual({ id: 'one', email: 'one@test' });
    expect(repeated).toBe(first);
    expect(findByIds).toHaveBeenCalledOnce();
    expect(findPage).toHaveBeenCalledWith(1, undefined);
  });

  it('enforces self-or-admin point visibility without changing me @spec:AC-310', async () => {
    const load = vi.fn((id: string) =>
      Promise.resolve({ id, email: `${id}@test` }),
    );
    const resolver = new IdentityResolver(
      { findPage: vi.fn() } as never,
      { load } as never,
    );

    await expect(resolver.me('one')).resolves.toMatchObject({ id: 'one' });
    await expect(
      resolver.user('one', context('one', ['marketplace:read'])),
    ).resolves.toMatchObject({ id: 'one' });
    await expect(
      resolver.user('two', context('one', ['marketplace:read'])),
    ).resolves.toBeNull();
    await expect(
      resolver.resolveReference(
        { id: 'two' },
        context('one', ['marketplace:read']),
      ),
    ).resolves.toBeNull();
    await expect(
      resolver.user('two', context('admin', ['identity:users:read'])),
    ).resolves.toMatchObject({ id: 'two' });
    await expect(
      resolver.resolveReference(
        { id: 'two' },
        context('admin', ['identity:users:read']),
      ),
    ).resolves.toMatchObject({ id: 'two' });
    await expect(resolver.user('one', {})).resolves.toBeNull();
    expect(load).toHaveBeenNthCalledWith(1, 'one');
    expect(load).toHaveBeenNthCalledWith(2, 'one');
    expect(load).toHaveBeenNthCalledWith(3, 'two');
    expect(load).toHaveBeenNthCalledWith(4, 'two');
  });

  it('returns nulls and propagates repository failures to every queued load @spec:AC-228', async () => {
    const missing = new FindIdentityUsersUseCase({
      findByIds: vi.fn().mockResolvedValue([]),
    } as never);
    await expect(missing.load('missing')).resolves.toBeNull();

    const failure = new Error('identity store unavailable');
    const failing = new FindIdentityUsersUseCase({
      findByIds: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(
      Promise.all([failing.load('one'), failing.load('two')]),
    ).rejects.toBe(failure);
  });
});
