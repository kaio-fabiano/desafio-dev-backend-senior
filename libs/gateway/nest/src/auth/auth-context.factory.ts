import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServerResponse } from 'node:http';

import { OAuthCredentialError } from '@desafio-dev-backend-senior/source/platform-nest';
import { GatewayContext } from '../application/dto/gateway-context.dto.ts';
import type { GatewayTokenVerifierPort } from '../application/ports/gateway-token-verifier.port.ts';
import { CreateGatewayContextUseCase } from '../application/use-cases/create-gateway-context.use-case.ts';
import { CommerceCookieAdapter } from '../infrastructure/http/commerce-cookie.adapter.ts';
import { GatewayRequestAdapter } from '../infrastructure/http/gateway-request.adapter.ts';
import type { GatewayRequest } from '../infrastructure/http/gateway-request.dto.ts';
import { GatewayUnauthenticatedError } from '../presentation/graphql/gateway-unauthenticated.error.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

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
        'https://gateway.marketplace.local',
    );
  }

  async create(
    request: GatewayRequest,
    response?: Pick<ServerResponse, 'getHeader' | 'setHeader'>,
  ): Promise<GatewayContext> {
    const authenticationRequest = GatewayRequestAdapter.toAuthenticationRequest(
      request,
      this.origin,
    );
    const verifier: GatewayTokenVerifierPort =
      typeof this.tokens.verifyToken === 'function'
        ? this.tokens
        : {
            verifyToken: () =>
              this.tokens.verify(
                GatewayRequestAdapter.toRequest(request, this.origin),
              ),
          };
    let context;
    try {
      context = await new CreateGatewayContextUseCase(
        verifier,
        new CommerceCookieAdapter(),
      ).execute(authenticationRequest);
    } catch (error) {
      if (OAuthCredentialError.isCredential(error)) {
        throw GatewayUnauthenticatedError.create();
      }
      throw error;
    }
    if (!response) return context;
    return new GatewayContext(
      context.authorization,
      context.principal,
      context.requestId,
      context.sessionHeaders,
      (name, value) => {
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
    );
  }
}
