import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import { IdentityUserConnection } from '../../application/dto/identity-user-connection.dto.ts';
import { IdentityUser } from '../../application/dto/identity-user.dto.ts';
import { IdentityUserQueryPort } from '../../application/ports/identity-user-query.port.ts';
import type { IdentityAuth } from '../../better-auth/identity-auth.types.d.ts';
import { UserCursorEncoder } from '../cursor/user-cursor.encoder.ts';

@Injectable()
export class BetterAuthIdentityUserAdapter implements IdentityUserQueryPort {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService<IdentityAuth>,
  ) {}

  async findByIds(ids: readonly string[]): Promise<IdentityUser[]> {
    if (ids.length === 0) return [];
    const users = await (
      await this.auth.instance.$context
    ).adapter.findMany<IdentityUser>({
      model: 'user',
      where: [{ field: 'id', operator: 'in', value: [...ids] }],
      limit: ids.length,
      select: ['id', 'email'],
    });
    return users.map(({ id, email }) => new IdentityUser(id, email));
  }

  async findPage(first: number, afterId?: string) {
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
    const page = users
      .slice(0, first)
      .map(({ id, email }) => new IdentityUser(id, email));
    const firstUser = page.at(0);
    const last = page.at(-1);
    return new IdentityUserConnection(
      page.map((node) => ({
        cursor: UserCursorEncoder.encode(node.id),
        node,
      })),
      {
        hasNextPage: users.length > first,
        hasPreviousPage: afterId !== undefined,
        startCursor: firstUser ? UserCursorEncoder.encode(firstUser.id) : null,
        endCursor: last ? UserCursorEncoder.encode(last.id) : null,
      },
    );
  }
}
