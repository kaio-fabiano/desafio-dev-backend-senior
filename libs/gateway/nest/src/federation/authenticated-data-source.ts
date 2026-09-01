import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import type { AuthContext } from '../auth/auth-context.factory.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<AuthContext> {
  private readonly origin?: string;

  constructor(config: { url: string }, sendOrigin = false) {
    super(config);
    this.origin = sendOrigin ? new URL(config.url).origin : undefined;
  }

  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<AuthContext>) {
    if (this.origin) request.http?.headers.set('origin', this.origin);
    if (!context || !('subject' in context) || !context.subject) return;

    request.http?.headers.set('x-authenticated-subject', context.subject);
    request.http?.headers.set(
      'x-authenticated-scopes',
      context.scopes.join(' '),
    );
    request.http?.headers.set('x-request-id', context.requestId);
    for (const [name, value] of Object.entries(context.sessionHeaders ?? {})) {
      if (typeof value === 'string') request.http?.headers.set(name, value);
    }
    if (context.supplierCompanyId) {
      request.http?.headers.set(
        'x-supplier-company-id',
        context.supplierCompanyId,
      );
    }
  }

  override didReceiveResponse({ response, context }: Parameters<
    NonNullable<RemoteGraphQLDataSource<AuthContext>['didReceiveResponse']>
  >[0]): any {
    for (const name of ['woocommerce-session', 'cart-token']) {
      const value = response.http?.headers.get(name);
      if (typeof value === 'string' && value) {
        context.setResponseHeader?.(name, value);
      }
    }
    const cookie = response.http?.headers.get('set-cookie');
    if (typeof cookie === 'string' && cookie) {
      context.setResponseHeader?.('set-cookie', cookie);
    }
    return response;
  }
}
