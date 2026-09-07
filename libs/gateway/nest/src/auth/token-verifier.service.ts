import { Inject, Injectable } from '@nestjs/common';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import type { AuthenticationPrincipal } from './authentication-principal.ts';
import { GatewayJwtHeaderValidator } from './gateway-jwt-header-validator.ts';

// Review: docs/reviews/gateway-auth-refactor.md
@Injectable()
export class TokenVerifierService {
  constructor(
    @Inject(OAuthResourceService)
    private readonly resources: OAuthResourceService,
  ) {}

  async verify(request: Request): Promise<AuthenticationPrincipal> {
    GatewayJwtHeaderValidator.assert(request.headers.get('authorization'));
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
