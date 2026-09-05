import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { IdentityResolver } from './identity.resolver.ts';
import { UserLoader } from './user.loader.ts';
import { IdentityUserRepository } from './user.repository.ts';

describe('IdentityResolver', () => {
  it('rejects malformed Relay cursors before querying Better Auth @spec:AC-228', async () => {
    const users = {
      findPage: vi.fn(),
    };
    const resolver = new IdentityResolver(users as never, {} as never);

    await expect(resolver.users(20, 'not a cursor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.findPage).not.toHaveBeenCalled();
  });

  it('maps pages and batches repeated user references per request @spec:AC-228', async () => {
    const findByIds = vi.fn().mockResolvedValue([{ id: 'one', email: 'one@test' }]);
    const findPage = vi.fn().mockResolvedValue({ edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } });
    const repository = { findByIds, findPage };
    const loader = new UserLoader(repository as never);
    const resolver = new IdentityResolver(repository as never, loader);

    await expect(resolver.users(0)).rejects.toBeInstanceOf(BadRequestException);
    await resolver.users(1);
    await resolver.users(1, Buffer.from('after').toString('base64url'));
    const [first, repeated] = await Promise.all([resolver.user('one'), resolver.user('one')]);
    expect(first).toEqual({ id: 'one', email: 'one@test' });
    expect(repeated).toBe(first);
    expect(findByIds).toHaveBeenCalledOnce();
    expect(findPage).toHaveBeenCalledWith(1, undefined);
  });

  it('resolves the authenticated subject and federation references @spec:AC-228', async () => {
    const load = vi.fn().mockResolvedValue({ id: 'one', email: 'one@test' });
    const resolver = new IdentityResolver(
      { findPage: vi.fn() } as never,
      { load } as never,
    );

    await expect(resolver.me('one')).resolves.toMatchObject({ id: 'one' });
    await expect(resolver.resolveReference({ id: 'two' })).resolves.toMatchObject({ id: 'one' });
    expect(load).toHaveBeenNthCalledWith(1, 'one');
    expect(load).toHaveBeenNthCalledWith(2, 'two');
  });

  it('returns nulls and propagates repository failures to every queued load @spec:AC-228', async () => {
    const missing = new UserLoader({ findByIds: vi.fn().mockResolvedValue([]) } as never);
    await expect(missing.load('missing')).resolves.toBeNull();

    const failure = new Error('identity store unavailable');
    const failing = new UserLoader({ findByIds: vi.fn().mockRejectedValue(failure) } as never);
    await expect(Promise.all([failing.load('one'), failing.load('two')])).rejects.toBe(failure);
  });

  it('reads Better Auth users through the repository boundary @spec:AC-228', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'one', email: 'one@test' }])
      .mockResolvedValueOnce([
        { id: 'one', email: 'one@test' },
        { id: 'two', email: 'two@test' },
      ])
      .mockResolvedValueOnce([]);
    const repository = new IdentityUserRepository({ instance: { $context: Promise.resolve({ adapter: { findMany } }) } } as never);
    await expect(repository.findByIds([])).resolves.toEqual([]);
    await expect(repository.findByIds(['one'])).resolves.toEqual([{ id: 'one', email: 'one@test' }]);
    const page = await repository.findPage(1, 'before');
    expect(page.edges).toHaveLength(1);
    expect(page.pageInfo).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: true,
    });
    await expect(repository.findPage(1)).resolves.toMatchObject({
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    });
  });
});
