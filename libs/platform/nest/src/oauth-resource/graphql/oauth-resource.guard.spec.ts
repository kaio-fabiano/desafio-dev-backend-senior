import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { APIError } from 'better-auth';
import { describe, expect, it, vi } from 'vitest';

import type { OAuthClaims } from '../oauth-resource.types.ts';
import { OAuthCredentialError } from '../verification/oauth-resource.errors.ts';
import { GraphqlOAuthResourceGuard } from './oauth-resource.guard.ts';
import { oauthSubjectFactory } from './oauth-subject.decorator.ts';
import { RequireScopes } from './require-scopes.decorator.ts';

function graphqlExecution(context: object): ExecutionContextHost {
  const execution = new ExecutionContextHost([{}, {}, context, {}]);
  execution.setType('graphql');
  return execution;
}

describe('GraphqlOAuthResourceGuard', () => {
  it('bypasses non-GraphQL requests', async () => {
    const verify = vi.fn();
    const getAllAndOverride = vi.fn();
    const execution = new ExecutionContextHost([]);
    execution.setType('http');
    const guard = new GraphqlOAuthResourceGuard(
      { verify } as never,
      { getAllAndOverride } as never,
    );

    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
    expect(getAllAndOverride).not.toHaveBeenCalled();
  });

  it('requires a request when no authentication is cached', async () => {
    const guard = new GraphqlOAuthResourceGuard(
      { verify: vi.fn() } as never,
      { getAllAndOverride: () => undefined } as never,
    );

    await expect(guard.canActivate(graphqlExecution({}))).rejects.toThrow(
      'Bearer token required',
    );
  });

  it('verifies once and stores authenticated claims in the GraphQL context', async () => {
    const auth: OAuthClaims = {
      audience: ['resource'],
      claims: {},
      scopes: ['orders:read'],
      subject: 'buyer-1',
    };
    const verify = vi.fn(async () => auth);
    const context = { req: { headers: { authorization: 'Bearer token' } } };
    const guard = new GraphqlOAuthResourceGuard(
      { verify } as never,
      { getAllAndOverride: () => ['orders:read'] } as never,
    );

    await expect(guard.canActivate(graphqlExecution(context))).resolves.toBe(
      true,
    );
    expect(verify).toHaveBeenCalledOnce();
    expect(context).toMatchObject({ auth });
  });

  it('returns ForbiddenException when verified claims lack a required scope', async () => {
    const guard = new GraphqlOAuthResourceGuard(
      { verify: vi.fn() } as never,
      { getAllAndOverride: () => ['orders:read'] } as never,
    );
    const context = {
      auth: {
        audience: ['resource'],
        claims: {},
        scopes: [],
        subject: 'buyer-1',
      },
    };

    await expect(guard.canActivate(graphqlExecution(context))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('maps a typed Better Auth credential rejection to UnauthorizedException', async () => {
    const guard = new GraphqlOAuthResourceGuard(
      {
        verify: vi.fn().mockRejectedValue(new APIError('UNAUTHORIZED')),
      } as never,
      { getAllAndOverride: () => [] } as never,
    );

    await expect(
      guard.canActivate(graphqlExecution({ req: { headers: {} } })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('maps a locally validated malformed claim to UnauthorizedException', async () => {
    const guard = new GraphqlOAuthResourceGuard(
      {
        verify: vi
          .fn()
          .mockRejectedValue(new OAuthCredentialError('Malformed claim')),
      } as never,
      { getAllAndOverride: () => [] } as never,
    );

    await expect(
      guard.canActivate(graphqlExecution({ req: { headers: {} } })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('preserves JWKS and unexpected operational failures', async () => {
    const operationalFailure = new Error('JWKS unavailable');
    const guard = new GraphqlOAuthResourceGuard(
      { verify: vi.fn().mockRejectedValue(operationalFailure) } as never,
      { getAllAndOverride: () => [] } as never,
    );

    await expect(
      guard.canActivate(graphqlExecution({ req: { headers: {} } })),
    ).rejects.toBe(operationalFailure);
  });
});

describe('OAuth GraphQL decorators', () => {
  it('stores the required scopes as Nest metadata', () => {
    class Resolver {
      operation(): boolean {
        return true;
      }
    }

    const decorate = RequireScopes('orders:read', 'cart:write');
    const descriptor = Object.getOwnPropertyDescriptor(
      Resolver.prototype,
      'operation',
    );
    expect(descriptor).toBeDefined();
    decorate(Resolver.prototype, 'operation', descriptor as PropertyDescriptor);

    const values = Reflect.getMetadataKeys(Resolver.prototype.operation).map(
      (key) => Reflect.getMetadata(key, Resolver.prototype.operation),
    );
    expect(values).toContainEqual(['orders:read', 'cart:write']);
  });

  it('returns the authenticated subject from GraphQL context', () => {
    expect(
      oauthSubjectFactory(
        undefined,
        graphqlExecution({ auth: { subject: 'buyer-1' } }) as never,
      ),
    ).toBe('buyer-1');
  });

  it('rejects a GraphQL context without an authenticated subject', () => {
    expect(() =>
      oauthSubjectFactory(undefined, graphqlExecution({}) as never),
    ).toThrow('Authenticated subject is required');
  });
});
