import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  Args,
  Context,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';

import type { IdentityAuth } from '../auth/better-auth.factory.ts';
import { MARKETPLACE_READ_SCOPE } from '../auth/plugins/oauth-provider-plugin.factory.ts';

export type IdentityUser = { id: string; email: string };
export type IdentityContext = { subject: string; scopes: readonly string[] };
export type UserConnection = {
  edges: Array<{ cursor: string; node: IdentityUser }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

function encodeCursor(id: string) {
  return Buffer.from(id).toString('base64url');
}

function decodeCursor(cursor?: string) {
  return cursor ? Buffer.from(cursor, 'base64url').toString() : undefined;
}

export class IdentityResolver {
  constructor(private readonly auth: AuthService<IdentityAuth>) {}

  async users(
    first = 20,
    after: string | undefined,
    context: IdentityContext,
  ): Promise<UserConnection> {
    this.requireRead(context);
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
    const last = page.at(-1);
    return {
      edges: page.map((node) => ({ cursor: encodeCursor(node.id), node })),
      pageInfo: {
        hasNextPage: users.length > first,
        endCursor: last ? encodeCursor(last.id) : null,
      },
    };
  }

  async user(id: string, context: IdentityContext) {
    this.requireRead(context);
    return this.findUser(id);
  }

  async me(context: IdentityContext) {
    this.requireRead(context);
    return this.findUser(context.subject);
  }

  async resolveReference(reference: { id: string }, context: IdentityContext) {
    this.requireRead(context);
    return this.findUser(reference.id);
  }

  private async findUser(id: string) {
    return (await this.auth.instance.$context).adapter.findOne<IdentityUser>({
      model: 'user',
      where: [{ field: 'id', value: id }],
      select: ['id', 'email'],
    });
  }

  private requireRead(context: IdentityContext) {
    if (!context.subject || !context.scopes.includes(MARKETPLACE_READ_SCOPE)) {
      throw new ForbiddenException('Identity read access denied');
    }
  }
}

Injectable()(IdentityResolver);
Inject(AuthService)(IdentityResolver, undefined, 0);
Resolver('User')(IdentityResolver);
Query('users')(
  IdentityResolver.prototype,
  'users',
  Object.getOwnPropertyDescriptor(IdentityResolver.prototype, 'users')!,
);
Args('first')(IdentityResolver.prototype, 'users', 0);
Args('after')(IdentityResolver.prototype, 'users', 1);
Context()(IdentityResolver.prototype, 'users', 2);
Query('user')(
  IdentityResolver.prototype,
  'user',
  Object.getOwnPropertyDescriptor(IdentityResolver.prototype, 'user')!,
);
Args('id')(IdentityResolver.prototype, 'user', 0);
Context()(IdentityResolver.prototype, 'user', 1);
Query('me')(
  IdentityResolver.prototype,
  'me',
  Object.getOwnPropertyDescriptor(IdentityResolver.prototype, 'me')!,
);
Context()(IdentityResolver.prototype, 'me', 0);
ResolveReference()(
  IdentityResolver.prototype,
  'resolveReference',
  Object.getOwnPropertyDescriptor(
    IdentityResolver.prototype,
    'resolveReference',
  )!,
);
Context()(IdentityResolver.prototype, 'resolveReference', 1);
