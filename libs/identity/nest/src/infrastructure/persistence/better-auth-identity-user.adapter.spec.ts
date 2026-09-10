import { describe, expect, it, vi } from 'vitest';

import { BetterAuthIdentityUserAdapter } from './better-auth-identity-user.adapter.ts';

type FindManyOptions = {
  limit?: number;
  where?: Array<{ operator: string; value: unknown }>;
};

function adapterWith(users: Array<{ id: string; email: string }>) {
  const findMany = vi.fn(async ({ limit, where }: FindManyOptions) => {
    const condition = where?.[0];
    const filtered = condition
      ? users.filter(({ id }) =>
          condition.operator === 'in'
            ? (condition.value as string[]).includes(id)
            : condition.operator === 'gt'
              ? id > String(condition.value)
              : id <= String(condition.value),
        )
      : users;
    return filtered.slice(0, limit);
  });
  return {
    adapter: new BetterAuthIdentityUserAdapter({
      instance: { $context: Promise.resolve({ adapter: { findMany } }) },
    } as never),
    findMany,
  };
}

describe('BetterAuthIdentityUserAdapter', () => {
  it('reads Better Auth users without duplicate persistence', async () => {
    const { adapter, findMany } = adapterWith([
      { id: 'one', email: 'one@test' },
      { id: 'two', email: 'two@test' },
    ]);

    await expect(adapter.findByIds([])).resolves.toEqual([]);
    await expect(adapter.findByIds(['two'])).resolves.toEqual([
      { id: 'two', email: 'two@test' },
    ]);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('derives hasPreviousPage from persisted rows for non-matching cursors @spec:AC-312', async () => {
    const { adapter } = adapterWith([
      { id: 'user-2', email: 'two@test' },
      { id: 'user-4', email: 'four@test' },
    ]);

    await expect(adapter.findPage(1, 'user-1')).resolves.toMatchObject({
      edges: [{ node: { id: 'user-2' } }],
      pageInfo: { hasNextPage: true, hasPreviousPage: false },
    });
    await expect(adapter.findPage(1, 'user-3')).resolves.toMatchObject({
      edges: [{ node: { id: 'user-4' } }],
      pageInfo: { hasNextPage: false, hasPreviousPage: true },
    });
  });

  it('reports an empty first page without adjacent pages', async () => {
    const { adapter } = adapterWith([]);

    await expect(adapter.findPage(1)).resolves.toEqual({
      edges: [],
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
      },
    });
  });
});
