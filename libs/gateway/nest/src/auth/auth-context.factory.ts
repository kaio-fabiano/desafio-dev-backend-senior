import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLError } from 'graphql';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

import { isOAuthCredentialError } from '@desafio-dev-backend-senior/source/platform-nest';
import {
  allowlistedCommerceCookies,
  COMMERCE_SESSION_REQUEST_HEADERS,
  type CommerceSessionHeaders,
  type GatewayContext,
} from './gateway-context.ts';
import {
  toGatewayRequest,
  trustedGatewayOrigin,
  type GatewayRequest,
} from './gateway-request.adapter.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

// Review: docs/reviews/gateway-auth-refactor.md
const DEFAULT_GATEWAY_ORIGIN = 'https://gateway.marketplace.local';

@Injectable()
export class AuthContextFactory {
  private readonly origin: string;

  constructor(
    @Inject(TokenVerifierService)
    private readonly tokens: TokenVerifierService,
    @Inject(ConfigService)
    config: ConfigService,
  ) {
    this.origin = trustedGatewayOrigin(
      config.get<string>('GATEWAY_ORIGIN') ??
        config.get<string>('GATEWAY_AUDIENCE') ??
        DEFAULT_GATEWAY_ORIGIN,
    );
  }

  async create(
    request: GatewayRequest,
    response?: Pick<ServerResponse, 'getHeader' | 'setHeader'>,
  ): Promise<GatewayContext> {
    const authenticationRequest = toGatewayRequest(request, this.origin);
    let principal;
    try {
      principal = await this.tokens.verify(authenticationRequest);
    } catch (error) {
      if (isOAuthCredentialError(error)) throw unauthenticatedGraphqlError();
      throw error;
    }

    const sessionHeaders: Partial<Record<string, string>> = {};
    for (const name of COMMERCE_SESSION_REQUEST_HEADERS) {
      const raw = authenticationRequest.headers.get(name)?.trim();
      const value = name === 'cookie' ? allowlistedCommerceCookies(raw) : raw;
      if (value) sessionHeaders[name] = value;
    }

    return {
      authorization: authenticationRequest.headers.get('authorization') ?? '',
      principal,
      requestId:
        authenticationRequest.headers.get('x-request-id') ?? randomUUID(),
      sessionHeaders: sessionHeaders as CommerceSessionHeaders,
      ...(response
        ? {
            setResponseHeader: (name: string, value: string | string[]) => {
              if (name !== 'set-cookie') {
                response.setHeader(name, value);
                return;
              }
              const existing = response.getHeader(name);
              const previous = Array.isArray(existing)
                ? existing.map(String)
                : typeof existing === 'string'
                  ? [existing]
                  : [];
              response.setHeader(name, [
                ...previous,
                ...(Array.isArray(value) ? value : [value]),
              ]);
            },
          }
        : {}),
    };
  }
}

function unauthenticatedGraphqlError(): GraphQLError {
  return new GraphQLError('Unauthorized', {
    extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
  });
}
