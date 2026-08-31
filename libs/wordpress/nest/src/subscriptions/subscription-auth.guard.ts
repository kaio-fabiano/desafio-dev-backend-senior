import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

export type SubscriptionContext = {
  subject: string;
  scopes: string[];
  requestId: string;
};

type SubscriptionTokenClaims = { sub?: string; scope?: string };

export type SubscriptionTokenOptions = {
  issuer: string;
  jwksUrl: string;
  audience: string;
  verify?: (request: Request) => Promise<SubscriptionTokenClaims>;
};

export const SUBSCRIPTION_TOKEN_OPTIONS = Symbol('SUBSCRIPTION_TOKEN_OPTIONS');

export function subscriptionTokenOptions(
  environment: NodeJS.ProcessEnv = process.env,
): SubscriptionTokenOptions {
  return {
    issuer:
      environment.OAUTH_ISSUER ?? 'http://identity-subgraph:3001/api/auth',
    jwksUrl:
      environment.IDENTITY_JWKS_URL ??
      'http://identity-subgraph:3001/api/auth/jwks',
    audience:
      environment.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
  };
}

export class SubscriptionAuthGuard implements CanActivate {
  constructor(private readonly options: SubscriptionTokenOptions) {}

  async authenticate(request: IncomingMessage): Promise<SubscriptionContext> {
    const resourceRequest = toFetchRequest(request);
    let claims: SubscriptionTokenClaims;
    try {
      claims = this.options.verify
        ? await this.options.verify(resourceRequest)
        : ((await verifyAccessTokenRequest(
            requestToResourceInput(resourceRequest),
            {
              jwksUrl: this.options.jwksUrl,
              verifyOptions: {
                issuer: this.options.issuer,
                audience: this.options.audience,
              },
              requiredScopes: ['orders:read'],
            },
          )) as SubscriptionTokenClaims);
    } catch {
      throw new UnauthorizedException('Valid access token is required');
    }
    return this.authorize({
      subject: claims.sub ?? '',
      scopes: (claims.scope ?? '').split(/\s+/).filter(Boolean),
      requestId: request.headers['x-request-id']?.toString() ?? randomUUID(),
    });
  }

  canActivate(context: ExecutionContext): boolean {
    this.authorize(
      GqlExecutionContext.create(context).getContext<SubscriptionContext>(),
    );
    return true;
  }

  private authorize(context?: SubscriptionContext): SubscriptionContext {
    if (!context?.subject.trim()) {
      throw new UnauthorizedException('Authenticated subject is required');
    }
    if (!context.scopes.includes('orders:read')) {
      throw new ForbiddenException('orders:read scope is required');
    }
    return context;
  }
}

Injectable()(SubscriptionAuthGuard);
Inject(SUBSCRIPTION_TOKEN_OPTIONS)(SubscriptionAuthGuard, undefined, 0);

function toFetchRequest(request: IncomingMessage): Request {
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index];
    const value = request.rawHeaders[index + 1];
    if (name && value !== undefined) headers.append(name, value);
  }
  return new Request(
    new URL(
      request.url ?? '/graphql/stream',
      `http://${request.headers.host ?? 'wordpress-federation'}`,
    ),
    { method: request.method, headers },
  );
}
