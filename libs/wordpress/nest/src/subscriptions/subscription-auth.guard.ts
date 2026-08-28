import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export type SubscriptionContext = {
  subject: string;
  scopes: string[];
  requestId: string;
};

export class SubscriptionAuthGuard implements CanActivate {
  authenticate(request: Pick<IncomingMessage, 'headers'>): SubscriptionContext {
    return this.authorize({
      subject: header(request.headers, 'x-authenticated-subject'),
      scopes: header(request.headers, 'x-authenticated-scopes')
        .split(/\s+/)
        .filter(Boolean),
      requestId: header(request.headers, 'x-request-id'),
    });
  }

  canActivate(context: ExecutionContext): boolean {
    this.authorize(
      GqlExecutionContext.create(context).getContext<SubscriptionContext>(),
    );
    return true;
  }

  private authorize(context: SubscriptionContext): SubscriptionContext {
    if (!context.subject.trim()) {
      throw new UnauthorizedException('Authenticated subject is required');
    }
    if (!context.scopes.includes('orders:read')) {
      throw new ForbiddenException('orders:read scope is required');
    }
    return context;
  }
}

Injectable()(SubscriptionAuthGuard);

function header(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
