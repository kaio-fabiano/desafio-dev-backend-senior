import {
  ForbiddenException,
  SetMetadata,
  UnauthorizedException,
  type Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { APIError } from 'better-auth';
import { describe, expect, it, vi } from 'vitest';

import type {
  OAuthClaims,
} from '../oauth-resource.types.ts';
import {
  OAUTH_AUTHENTICATION_MESSAGES,
  OAuthCredentialError,
} from '../verification/oauth-resource.errors.ts';
import { GraphqlOAuthResourceGuard } from './oauth-resource.guard.ts';
import { REQUIRED_SCOPES } from './require-scopes.decorator.ts';

function graphqlExecution(
  context: object,
  constructorRef?: Type,
  handler?: (...args: never[]) => unknown,
): ExecutionContextHost {
  const execution = new ExecutionContextHost(
    [{}, {}, context, {}],
    constructorRef,
    handler,
  );
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
    await expect(guard.canActivate(graphqlExecution(context))).resolves.toBe(
      true,
    );
    expect(verify).toHaveBeenCalledOnce();
    expect(context).toMatchObject({ auth });
  });

  it('AC-220: requires every scope with case-sensitive matching @spec:AC-220', async () => {
    expect(OAUTH_AUTHENTICATION_MESSAGES.requiredScopeMissing).toBe(
      'Required OAuth scope is missing',
    );
    const guard = new GraphqlOAuthResourceGuard(
      { verify: vi.fn() } as never,
      {
        getAllAndOverride: () => ['orders:read', 'cart:write'],
      } as never,
    );
    const context = {
      auth: {
        audience: ['resource'],
        claims: {},
        scopes: ['orders:read', 'CART:WRITE'],
        subject: 'buyer-1',
      },
    };

    await expect(guard.canActivate(graphqlExecution(context))).rejects.toThrow(
      OAUTH_AUTHENTICATION_MESSAGES.requiredScopeMissing,
    );
  });

  it('prefers method scope metadata over class scope metadata', async () => {
    class Resolver {
      operation(): boolean {
        return true;
      }
    }
    SetMetadata(REQUIRED_SCOPES, ['class:read'])(Resolver);
    const descriptor = Object.getOwnPropertyDescriptor(
      Resolver.prototype,
      'operation',
    );
    SetMetadata(REQUIRED_SCOPES, ['method:read'])(
      Resolver.prototype,
      'operation',
      descriptor as PropertyDescriptor,
    );
    const guard = new GraphqlOAuthResourceGuard(
      { verify: vi.fn() } as never,
      new Reflector(),
    );
    const context = {
      auth: {
        audience: ['resource'],
        claims: {},
        scopes: ['method:read'],
        subject: 'buyer-1',
      },
    };

    await expect(
      guard.canActivate(
        graphqlExecution(context, Resolver, Resolver.prototype.operation),
      ),
    ).resolves.toBe(true);
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
