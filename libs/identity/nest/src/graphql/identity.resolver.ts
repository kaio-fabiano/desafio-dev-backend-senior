import { BadRequestException, Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Parent,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';

import {
  OAuthSubject,
  RequireScopes,
  type OAuthGraphQLContext,
} from '@desafio-dev-backend-senior/source/platform-nest';
import { IdentityUserVisibilityPolicy } from '../application/policies/identity-user-visibility.policy.ts';
import { IdentityUserQueryPort } from '../application/ports/identity-user-query.port.ts';
import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';
import { FindIdentityUsersUseCase } from '../application/use-cases/find-identity-users.use-case.ts';
import { ListIdentityUsersUseCase } from '../application/use-cases/list-identity-users.use-case.ts';
import { OAuthResources } from '../oauth-issuer/oauth-resources.ts';
import { UserCursorDecoder } from '../presentation/graphql/user-cursor.decoder.ts';

@Resolver('User')
export class IdentityResolver {
  constructor(
    @Inject(ListIdentityUsersUseCase)
    private readonly userQueries:
      | ListIdentityUsersUseCase
      | Pick<IdentityUserQueryPort, 'findPage'>,
    @Inject(FindIdentityUsersUseCase)
    private readonly usersById: Pick<FindIdentityUsersUseCase, 'load'>,
  ) {}

  @Query('users')
  @RequireScopes(OAuthResources.identityUsersReadScope)
  async users(@Args('first') first = 20, @Args('after') after?: string) {
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new BadRequestException(IdentityErrorMessages.invalidUserPageSize);
    }
    const afterId = UserCursorDecoder.decode(after);
    return 'execute' in this.userQueries
      ? this.userQueries.execute(first, afterId)
      : this.userQueries.findPage(first, afterId);
  }

  @Query('user')
  @RequireScopes()
  async user(@Args('id') id: string, @Context() context: OAuthGraphQLContext) {
    if (!this.canRead(id, context)) return null;
    return this.usersById.load(id);
  }

  @Query('me')
  @RequireScopes(OAuthResources.marketplaceReadScope)
  me(@OAuthSubject() subject: string) {
    return this.usersById.load(subject);
  }

  @ResolveReference()
  @RequireScopes()
  async resolveReference(
    @Parent() reference: { id: string },
    @Context() context: OAuthGraphQLContext,
  ) {
    if (!this.canRead(reference.id, context)) return null;
    return this.usersById.load(reference.id);
  }

  private canRead(userId: string, context: OAuthGraphQLContext): boolean {
    return context.auth
      ? IdentityUserVisibilityPolicy.allows(
          userId,
          context.auth.subject,
          context.auth.scopes,
        )
      : false;
  }
}
