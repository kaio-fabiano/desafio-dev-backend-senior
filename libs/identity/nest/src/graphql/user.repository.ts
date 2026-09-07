import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from '../better-auth/identity-auth.types.d.ts';
import type { IdentityUser, UserConnection } from './identity-user.types.d.ts';
import { UserCursorEncoder } from './user-cursor.encoder.ts';

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
      edges: page.map((node) => ({ cursor: UserCursorEncoder.encode(node.id), node })),
      pageInfo: {
        hasNextPage: users.length > first,
        hasPreviousPage: afterId !== undefined,
        startCursor: firstUser ? UserCursorEncoder.encode(firstUser.id) : null,
        endCursor: last ? UserCursorEncoder.encode(last.id) : null,
      },
    };
  }
}
