import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import {
  OAuthResourceService,
  type OAuthClaims,
  toOAuthRequest,
} from './oauth-resource.service.ts';

const REQUIRED_SCOPES = Symbol('REQUIRED_SCOPES');

export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRED_SCOPES, scopes);

export const OAuthSubject = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext) => {
    const context =
      GqlExecutionContext.create(executionContext).getContext<AuthenticatedContext>();
    if (!context.auth?.subject) {
      throw new UnauthorizedException('Authenticated subject is required');
    }
    return context.auth.subject;
  },
);

type AuthenticatedContext = {
  auth?: OAuthClaims;
  req?: Parameters<typeof toOAuthRequest>[0];
};

export class GraphqlOAuthResourceGuard implements CanActivate {
  constructor(
    private readonly resources: OAuthResourceService,
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
      GqlExecutionContext.create(executionContext).getContext<AuthenticatedContext>();
    if (context.auth) {
      assertScopes(context.auth, scopes);
      return true;
    }
    if (!context.req) throw new UnauthorizedException('Bearer token required');
    let auth: OAuthClaims;
    try {
      auth = await this.resources.verify(toOAuthRequest(context.req));
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
    context.auth = auth;
    assertScopes(auth, scopes);
    return true;
  }
}

Injectable()(GraphqlOAuthResourceGuard);
Inject(OAuthResourceService)(GraphqlOAuthResourceGuard, undefined, 0);
Inject(Reflector)(GraphqlOAuthResourceGuard, undefined, 1);

function assertScopes(auth: OAuthClaims, requiredScopes: readonly string[]) {
  if (!requiredScopes.every((scope) => auth.scopes.includes(scope))) {
    throw new ForbiddenException('Required OAuth scope is missing');
  }
}
