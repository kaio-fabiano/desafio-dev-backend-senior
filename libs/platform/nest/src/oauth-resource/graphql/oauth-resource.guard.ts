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

import type { OAuthClaims } from '../oauth-resource.types.ts';
import { toOAuthRequest } from '../verification/oauth-request.adapter.ts';
import {
  isOAuthCredentialError,
  OAUTH_AUTHENTICATION_MESSAGES,
} from '../verification/oauth-resource.errors.ts';
import { OAuthResourceService } from '../verification/oauth-resource.service.ts';
import { REQUIRED_SCOPES } from './require-scopes.decorator.ts';

// TODO(oauth-resource-guard): Harden and document GraphQL OAuth resource
// enforcement without collapsing trust boundaries. Preserve independent token
// verification at the gateway and every subgraph for their respective audiences,
// reusing context.auth only within the current GraphQL request.
//
// Add tests proving issuer, audience, signature, expiration, not-before,
// algorithm policy, JWKS caching and rotation, case-sensitive all-scope semantics,
// non-GraphQL bypass, and once-per-request verification.
//
type AuthenticatedContext = {
  auth?: OAuthClaims;
  req?: Parameters<typeof toOAuthRequest>[0];
};

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
      ).getContext<AuthenticatedContext>();
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

function assertScopes(auth: OAuthClaims, requiredScopes: readonly string[]) {
  if (!requiredScopes.every((scope) => auth.scopes.includes(scope))) {
    throw new ForbiddenException('Required OAuth scope is missing');
  }
}
