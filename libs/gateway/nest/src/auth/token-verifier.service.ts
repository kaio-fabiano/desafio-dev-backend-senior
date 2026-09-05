import { Inject, Injectable } from '@nestjs/common';

import {
  OAuthCredentialError,
  OAuthResourceService,
} from '@desafio-dev-backend-senior/source/platform-nest';
import type { AuthenticationPrincipal } from './gateway-context.ts';

// Review: docs/reviews/gateway-auth-refactor.md
@Injectable()
export class TokenVerifierService {
  constructor(
    @Inject(OAuthResourceService)
    private readonly resources: OAuthResourceService,
  ) {}

  async verify(request: Request): Promise<AuthenticationPrincipal> {
    assertGatewayJwtHeader(request.headers.get('authorization'));
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

function assertGatewayJwtHeader(authorization: string | null): void {
  if (!authorization) return;
  const compact = /^\S+\s+(\S+)$/.exec(authorization)?.[1];
  const encodedHeader = compact?.split('.')[0];
  if (!compact || compact.split('.').length !== 3 || !encodedHeader) {
    throw new OAuthCredentialError('Access token must be a compact JWT');
  }
  let header: unknown;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString());
  } catch {
    throw new OAuthCredentialError('Access token header must be valid JSON');
  }
  if (
    typeof header !== 'object' ||
    header === null ||
    !('kid' in header) ||
    typeof header.kid !== 'string' ||
    header.kid.length === 0
  ) {
    throw new OAuthCredentialError('Access token key ID is required');
  }
  if (!('alg' in header) || header.alg !== 'ES256') {
    throw new OAuthCredentialError('Access token algorithm must be ES256');
  }
}
