import { BadRequestException, Inject } from '@nestjs/common';
import { Args, Query, ResolveReference, Resolver } from '@nestjs/graphql';

import {
  OAuthSubject,
  RequireScopes,
} from '@desafio-dev-backend-senior/source/platform-nest';
import { MARKETPLACE_READ_SCOPE } from '../oauth-issuer/oauth-resources.ts';
import { UserLoader } from './user.loader.ts';
import { IdentityUserRepository } from './user.repository.ts';

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

@Resolver('User')
export class IdentityResolver {
  constructor(
    @Inject(IdentityUserRepository)
    private readonly userRepository: IdentityUserRepository,
    @Inject(UserLoader)
    private readonly usersById: UserLoader,
  ) {}

  @Query('users')
  @RequireScopes(MARKETPLACE_READ_SCOPE)
  async users(
    @Args('first') first = 20,
    @Args('after') after?: string,
  ): Promise<UserConnection> {
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new BadRequestException('first must be between 1 and 100');
    }
    return this.userRepository.findPage(first, decodeCursor(after));
  }

  @Query('user')
  @RequireScopes(MARKETPLACE_READ_SCOPE)
  user(@Args('id') id: string) {
    return this.usersById.load(id);
  }

  @Query('me')
  @RequireScopes(MARKETPLACE_READ_SCOPE)
  me(@OAuthSubject() subject: string) {
    return this.usersById.load(subject);
  }

  @ResolveReference()
  @RequireScopes(MARKETPLACE_READ_SCOPE)
  resolveReference(reference: { id: string }) {
    return this.usersById.load(reference.id);
  }
}

function decodeCursor(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new BadRequestException('Invalid user cursor');
  }
  const id = Buffer.from(cursor, 'base64url').toString();
  if (!id || Buffer.from(id).toString('base64url') !== cursor) {
    throw new BadRequestException('Invalid user cursor');
  }
  return id;
}
