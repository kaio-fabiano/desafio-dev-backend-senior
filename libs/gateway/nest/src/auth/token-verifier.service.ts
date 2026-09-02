import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import type { AuthContext } from './auth-context.factory.ts';

export class TokenVerifierService {
  constructor(private readonly resources: OAuthResourceService) {}

  async verify(request: Request): Promise<AuthContext> {
    const auth = await this.resources.verify(request);
    const supplierCompanyId = auth.claims.supplierCompanyId;
    return {
      authorization: request.headers.get('authorization') ?? '',
      subject: auth.subject,
      scopes: auth.scopes,
      audience: auth.audience,
      ...(typeof supplierCompanyId === 'string' ? { supplierCompanyId } : {}),
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    };
  }
}

Injectable()(TokenVerifierService);
Inject(OAuthResourceService)(TokenVerifierService, undefined, 0);
