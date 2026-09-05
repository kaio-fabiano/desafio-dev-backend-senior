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

import type {
  OAuthClaims,
  OAuthGraphQLContext,
} from '../oauth-resource.types.ts';
import { toOAuthRequest } from '../verification/oauth-request.adapter.ts';
import {
  isOAuthCredentialError,
  OAUTH_AUTHENTICATION_MESSAGES,
} from '../verification/oauth-resource.errors.ts';
import { OAuthResourceService } from '../verification/oauth-resource.service.ts';
import { REQUIRED_SCOPES } from './require-scopes.decorator.ts';

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
      this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_SCOPES, [
        executionContext.getHandler(),
        executionContext.getClass(),
      ]) ?? [];
    const context =
      GqlExecutionContext.create(
        executionContext,
      ).getContext<OAuthGraphQLContext>();
    if (context.auth) {
      assertScopes(context.auth, scopes);
      return true;
    }
    if (!context.req) {
      throw new UnauthorizedException(
        OAUTH_AUTHENTICATION_MESSAGES.bearerTokenRequired,
      );
    }
    let auth: OAuthClaims;
    try {
      auth = await this.resources.verify(toOAuthRequest(context.req));
    } catch (error) {
      if (!isOAuthCredentialError(error)) throw error;
      throw new UnauthorizedException(
        OAUTH_AUTHENTICATION_MESSAGES.invalidBearerToken,
      );
    }
    context.auth = auth;
    assertScopes(auth, scopes);
    return true;
  }
}

function assertScopes(
  auth: OAuthClaims,
  requiredScopes: readonly string[],
): void {
  if (!requiredScopes.every((scope) => auth.scopes.includes(scope))) {
    throw new ForbiddenException(
      OAUTH_AUTHENTICATION_MESSAGES.requiredScopeMissing,
    );
  }
}
