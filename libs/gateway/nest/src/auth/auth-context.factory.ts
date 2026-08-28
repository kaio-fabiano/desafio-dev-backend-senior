import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';

import {
  TokenVerifierService,
  type VerifyGatewayRequest,
  type VerifyOptions,
  verifyGatewayRequest,
} from './token-verifier.service.ts';

export type AuthContext = {
  subject: string;
  scopes: readonly string[];
  audience: readonly string[];
  supplierCompanyId?: string;
  requestId: string;
};

type GatewayRequest = Pick<
  IncomingMessage,
  'headers' | 'method' | 'rawHeaders' | 'url'
> & { protocol?: string; originalUrl?: string };

function toFetchRequest(request: GatewayRequest) {
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index];
    const value = request.rawHeaders[index + 1];
    if (name && value !== undefined) headers.append(name, value);
  }
  const protocol = request.protocol ?? 'http';
  const host = request.headers.host ?? 'gateway.local';
  return new Request(
    new URL(
      request.originalUrl ?? request.url ?? '/graphql',
      `${protocol}://${host}`,
    ),
    { method: request.method, headers },
  );
}

export class AuthContextFactory {
  constructor(private readonly tokens: TokenVerifierService) {}

  async create(request: GatewayRequest): Promise<AuthContext> {
    try {
      return await this.tokens.verify(toFetchRequest(request));
    } catch {
      throw new GraphQLError('Unauthorized', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    }
  }
}

Injectable()(AuthContextFactory);
Inject(TokenVerifierService)(AuthContextFactory, undefined, 0);

type AuthenticatedRequest = IncomingMessage & { authContext?: AuthContext };

/** Compatibility middleware for non-Nest callers; the Gateway uses the provider above. */
export function createGatewayAuthMiddleware(
  token: VerifyOptions,
  verify: VerifyGatewayRequest = verifyGatewayRequest,
) {
  return async (
    request: AuthenticatedRequest,
    response: ServerResponse,
    next: () => void,
  ) => {
    try {
      request.authContext = await verify(toFetchRequest(request), token);
      next();
    } catch {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));
    }
  };
}
