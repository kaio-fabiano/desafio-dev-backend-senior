import { timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
//TODO: Avaliar esse Federation Auth guard aparentemente é pra usar um recurso do betterauth de OAuth2, mas não está sendo usado
@Injectable()
export class FederationAuthGuard implements CanActivate {
  canActivate(executionContext: ExecutionContext): boolean {
    if (executionContext.getType<string>() !== 'graphql') return true;
    const context = GqlExecutionContext.create(executionContext).getContext<{
      req?: { headers?: Record<string, string | string[] | undefined> };
    }>();
    const received = String(
      context.req?.headers?.['x-federation-secret'] ?? '',
    );
    const expected = process.env.FEDERATION_INTERNAL_SECRET ?? '';
    if (
      !expected ||
      received.length !== expected.length ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('Untrusted federation request');
    }
    return true;
  }
}
