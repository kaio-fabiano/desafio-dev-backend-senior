import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

import { isOAuthCredentialError } from '@desafio-dev-backend-senior/source/platform-nest';
import { CommerceCookiePolicy } from './commerce-cookie-policy.ts';
import { CommerceSessionRequestHeaders } from './commerce-session-request-headers.ts';
import type { CommerceSessionHeaders } from './commerce-session-headers.ts';
import type { GatewayContext } from './gateway-context.ts';
import { GatewayRequestAdapter } from './gateway-request.adapter.ts';
import type { GatewayRequest } from './gateway-request.ts';
import { TokenVerifierService } from './token-verifier.service.ts';
import { GatewayAuthenticationConfiguration } from './gateway-authentication.configuration.ts';
import { GatewayUnauthenticatedError } from './gateway-unauthenticated.error.ts';

@Injectable()
export class AuthContextFactory {
  private readonly origin: string;

  constructor(
    @Inject(TokenVerifierService)
    private readonly tokens: TokenVerifierService,
    @Inject(ConfigService)
    config: ConfigService,
  ) {
    this.origin = GatewayRequestAdapter.trustedOrigin(
      config.get<string>('GATEWAY_ORIGIN') ??
        config.get<string>('GATEWAY_AUDIENCE') ??
        GatewayAuthenticationConfiguration.defaultOrigin,
    );
  }

  async create(
    request: GatewayRequest,
    response?: Pick<ServerResponse, 'getHeader' | 'setHeader'>,
  ): Promise<GatewayContext> {
    const authenticationRequest = GatewayRequestAdapter.toRequest(request, this.origin);
    let principal;
    try {
      principal = await this.tokens.verify(authenticationRequest);
    } catch (error) {
      if (isOAuthCredentialError(error)) throw GatewayUnauthenticatedError.create();
      throw error;
    }

    const sessionHeaders: Partial<Record<string, string>> = {};
    for (const name of CommerceSessionRequestHeaders.values) {
      const raw = authenticationRequest.headers.get(name)?.trim();
      const value = name === 'cookie' ? CommerceCookiePolicy.allowlisted(raw) : raw;
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
