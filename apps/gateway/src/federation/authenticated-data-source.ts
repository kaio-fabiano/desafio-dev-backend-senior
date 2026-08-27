import { RemoteGraphQLDataSource } from '@apollo/gateway';

import type { AuthContext } from '../auth/auth-context.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<AuthContext> {
  override willSendRequest({
    request,
    context,
  }: {
    request: { http?: { headers: Headers } };
    context: AuthContext;
  }) {
    request.http?.headers.set('x-authenticated-subject', context.subject);
    request.http?.headers.set(
      'x-authenticated-scopes',
      context.scopes.join(' '),
    );
    request.http?.headers.set('x-request-id', context.requestId);
    if (context.supplierCompanyId) {
      request.http?.headers.set(
        'x-supplier-company-id',
        context.supplierCompanyId,
      );
    }
  }
}
