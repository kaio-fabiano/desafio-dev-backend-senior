import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import type { AuthContext } from '../auth/auth-context.factory.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<AuthContext> {
  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<AuthContext>) {
    if (!context || !('subject' in context) || !context.subject) return;

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
