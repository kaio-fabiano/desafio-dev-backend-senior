import { Inject, Injectable } from '@nestjs/common';
import { Args, Query, ResolveReference, Resolver } from '@nestjs/graphql';
import { AuthService } from '@thallesp/nestjs-better-auth';

import {
  OAuthSubject,
  RequireScopes,
} from '@desafio-dev-backend-senior/source/platform-nest';
import type { IdentityAuth } from '../auth/better-auth.factory.ts';
import { MARKETPLACE_READ_SCOPE } from '../auth/resource-audiences.ts';
import { UserLoader } from './user.loader.ts';

export type IdentityUser = { id: string; email: string };
export type UserConnection = {
  edges: Array<{ cursor: string; node: IdentityUser }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
};

function encodeCursor(id: string) {
  return Buffer.from(id).toString('base64url');
}

function decodeCursor(cursor?: string) {
  return cursor ? Buffer.from(cursor, 'base64url').toString() : undefined;
}

export class IdentityResolver {
  constructor(
    private readonly auth: AuthService<IdentityAuth>,
    private readonly usersById: UserLoader,
  ) {}

  async users(first = 20, after: string | undefined): Promise<UserConnection> {
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new Error('first must be between 1 and 100');
    }
    const afterId = decodeCursor(after);
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

  async user(id: string) {
    return this.findUser(id);
  }

  async me(subject: string) {
    return this.findUser(subject);
  }

  async resolveReference(reference: { id: string }) {
    return this.findUser(reference.id);
  }

  private async findUser(id: string) {
    return this.usersById.load(id);
  }
}

Injectable()(IdentityResolver);
Inject(AuthService)(IdentityResolver, undefined, 0);
Inject(UserLoader)(IdentityResolver, undefined, 1);
Resolver('User')(IdentityResolver);

function resolverDescriptor(method: keyof IdentityResolver) {
  const descriptor = Object.getOwnPropertyDescriptor(
    IdentityResolver.prototype,
    method,
  );
  if (!descriptor) throw new Error(`Identity resolver ${method} is missing`);
  return descriptor;
}

Query('users')(
  IdentityResolver.prototype,
  'users',
  resolverDescriptor('users'),
);
Args('first')(IdentityResolver.prototype, 'users', 0);
Args('after')(IdentityResolver.prototype, 'users', 1);
RequireScopes(MARKETPLACE_READ_SCOPE)(
  IdentityResolver.prototype,
  'users',
  resolverDescriptor('users'),
);
Query('user')(IdentityResolver.prototype, 'user', resolverDescriptor('user'));
Args('id')(IdentityResolver.prototype, 'user', 0);
RequireScopes(MARKETPLACE_READ_SCOPE)(
  IdentityResolver.prototype,
  'user',
  resolverDescriptor('user'),
);
Query('me')(IdentityResolver.prototype, 'me', resolverDescriptor('me'));
OAuthSubject()(IdentityResolver.prototype, 'me', 0);
RequireScopes(MARKETPLACE_READ_SCOPE)(
  IdentityResolver.prototype,
  'me',
  resolverDescriptor('me'),
);
ResolveReference()(
  IdentityResolver.prototype,
  'resolveReference',
  resolverDescriptor('resolveReference'),
);
RequireScopes(MARKETPLACE_READ_SCOPE)(
  IdentityResolver.prototype,
  'resolveReference',
  resolverDescriptor('resolveReference'),
);
