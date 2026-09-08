import { Inject, Injectable } from '@nestjs/common';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import type { AuthenticationPrincipal } from '../application/dto/authentication-principal.dto.ts';
import type { GatewayAuthenticationRequest } from '../application/dto/gateway-authentication-request.dto.ts';
import { GatewayTokenVerifierPort } from '../application/ports/gateway-token-verifier.port.ts';
import { GatewayJwtHeaderAdapter } from '../infrastructure/auth/gateway-jwt-header.adapter.ts';

// Review: docs/reviews/gateway-auth-refactor.md
@Injectable()
export class TokenVerifierService extends GatewayTokenVerifierPort {
  constructor(
    @Inject(OAuthResourceService)
    private readonly resources: OAuthResourceService,
  ) {
    super();
  }

  async verify(request: Request): Promise<AuthenticationPrincipal> {
    return this.verifyRequest(request);
  }

  async verifyToken(
    request: GatewayAuthenticationRequest,
  ): Promise<AuthenticationPrincipal> {
    const headers = new Headers();
    if (request.authorization) {
      headers.set('authorization', request.authorization);
    }
    if (request.dpop) headers.set('dpop', request.dpop);
    return this.verifyRequest(
      new Request(request.url, {
        headers,
        method: request.method,
      }),
    );
  }

  private async verifyRequest(
    request: Request,
  ): Promise<AuthenticationPrincipal> {
    GatewayJwtHeaderAdapter.assert(request.headers.get('authorization'));
    const auth = await this.resources.verify(request);
    const supplierCompanyId = auth.claims.supplierCompanyId;
    return {
      audience: auth.audience,
      scopes: auth.scopes,
      subject: auth.subject,
      ...(typeof supplierCompanyId === 'string' ? { supplierCompanyId } : {}),
    };
  }
}
