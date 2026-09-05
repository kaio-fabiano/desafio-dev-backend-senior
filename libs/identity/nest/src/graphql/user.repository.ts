import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from '../better-auth/better-auth.factory.ts';
import type { IdentityUser, UserConnection } from './identity.resolver.ts';

@Injectable()
export class IdentityUserRepository {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService<IdentityAuth>,
  ) {}

  async findByIds(ids: readonly string[]): Promise<IdentityUser[]> {
    if (ids.length === 0) return [];
    return (await this.auth.instance.$context).adapter.findMany<IdentityUser>({
      model: 'user',
      where: [{ field: 'id', operator: 'in', value: [...ids] }],
      limit: ids.length,
      select: ['id', 'email'],
    });
  }

  async findPage(first: number, afterId?: string): Promise<UserConnection> {
    const users = await (
      await this.auth.instance.$context
    ).adapter.findMany<IdentityUser>({
      model: 'user',
      where: afterId
        ? [{ field: 'id', operator: 'gt', value: afterId }]
        : undefined,
      limit: first + 1,
      select: ['id', 'email'],
      sortBy: { field: 'id', direction: 'asc' },
    });
    const page = users.slice(0, first);
    const firstUser = page.at(0);
    const last = page.at(-1);
    return {
      edges: page.map((node) => ({ cursor: encodeCursor(node.id), node })),
      pageInfo: {
        hasNextPage: users.length > first,
        hasPreviousPage: afterId !== undefined,
        startCursor: firstUser ? encodeCursor(firstUser.id) : null,
        endCursor: last ? encodeCursor(last.id) : null,
      },
    };
  }
}

export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url');
}
