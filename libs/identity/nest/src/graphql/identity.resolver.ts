import { BadRequestException, Inject } from '@nestjs/common';
import { Args, Query, ResolveReference, Resolver } from '@nestjs/graphql';

import {
  OAuthSubject,
  RequireScopes,
} from '@desafio-dev-backend-senior/source/platform-nest';
import { OAuthResources } from '../oauth-issuer/oauth-resources.ts';
import type { UserConnection } from './identity-user.types.d.ts';
import { UserCursorDecoder } from './user-cursor.decoder.ts';
import { UserLoader } from './user.loader.ts';
import { IdentityUserRepository } from './user.repository.ts';

@Resolver('User')
export class IdentityResolver {
  constructor(
    @Inject(IdentityUserRepository)
    private readonly userRepository: IdentityUserRepository,
    @Inject(UserLoader)
    private readonly usersById: UserLoader,
  ) {}

  @Query('users')
  @RequireScopes(OAuthResources.marketplaceReadScope)
  async users(
    @Args('first') first = 20,
    @Args('after') after?: string,
  ): Promise<UserConnection> {
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new BadRequestException('first must be between 1 and 100');
    }
    return this.userRepository.findPage(first, UserCursorDecoder.decode(after));
  }

  @Query('user')
  @RequireScopes(OAuthResources.marketplaceReadScope)
  user(@Args('id') id: string) {
    return this.usersById.load(id);
  }

  @Query('me')
  @RequireScopes(OAuthResources.marketplaceReadScope)
  me(@OAuthSubject() subject: string) {
    return this.usersById.load(subject);
  }

  @ResolveReference()
  @RequireScopes(OAuthResources.marketplaceReadScope)
  resolveReference(reference: { id: string }) {
    return this.usersById.load(reference.id);
  }
}
