import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { OAuthCredentialError } from '../domain/errors/oauth-credential.error.ts';
import { RequiredScopesPolicy } from '../domain/policies/required-scopes.policy.ts';
import type { OAuthClaims } from '../domain/value-objects/oauth-claims.ts';
import { OAuthAuthenticationMessages } from '../presentation/graphql/oauth-authentication-messages.ts';
import type { OAuthGraphQLContext } from '../presentation/graphql/oauth-graphql-context.ts';
import { RequiredScopesMetadata } from '../presentation/graphql/required-scopes.metadata.ts';
import { OAuthRequestAdapter } from '../verification/oauth-request.adapter.ts';
import { OAuthResourceService } from '../verification/oauth-resource.service.ts';

/**
 * Authenticates GraphQL operations for the audience configured by the current
 * resource server and enforces operation-level OAuth scopes. Verified claims
 * are cached only in the current GraphQL request context.
 */
@Injectable()
export class GraphqlOAuthResourceGuard implements CanActivate {
  constructor(
    @Inject(OAuthResourceService)
    private readonly resources: OAuthResourceService,
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    if (executionContext.getType<string>() !== 'graphql') return true;
    const scopes =
      this.reflector.getAllAndOverride<readonly string[]>(
        RequiredScopesMetadata.key,
        [executionContext.getHandler(), executionContext.getClass()],
      ) ?? [];
    const context =
      GqlExecutionContext.create(
        executionContext,
      ).getContext<OAuthGraphQLContext>();
    if (context.auth) {
      this.assertScopes(context.auth, scopes);
      return true;
    }
    if (!context.req) {
      throw new UnauthorizedException(
        OAuthAuthenticationMessages.bearerTokenRequired,
      );
    }
    let auth: OAuthClaims;
    try {
      auth = await this.resources.verify(
        OAuthRequestAdapter.toRequest(context.req),
      );
    } catch (error) {
      if (!OAuthCredentialError.isCredential(error)) throw error;
      throw new UnauthorizedException(
        OAuthAuthenticationMessages.invalidBearerToken,
      );
    }
    context.auth = auth;
    this.assertScopes(auth, scopes);
    return true;
  }

  private assertScopes(
    auth: OAuthClaims,
    requiredScopes: readonly string[],
  ): void {
    if (!RequiredScopesPolicy.allows(auth, requiredScopes)) {
      throw new ForbiddenException(
        OAuthAuthenticationMessages.requiredScopeMissing,
      );
    }
  }
}
