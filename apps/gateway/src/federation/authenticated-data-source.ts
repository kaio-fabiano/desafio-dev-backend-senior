import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import type { AuthContext } from '../auth/auth-context.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<AuthContext> {
  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<AuthContext>) {
    const authContext = context as AuthContext | undefined;
    if (!authContext?.subject || !authContext.scopes) return;

    request.http?.headers.set('x-authenticated-subject', authContext.subject);
    request.http?.headers.set(
      'x-authenticated-scopes',
      authContext.scopes.join(' '),
    );
    request.http?.headers.set('x-request-id', authContext.requestId);
    if (authContext.supplierCompanyId) {
      request.http?.headers.set(
        'x-supplier-company-id',
        authContext.supplierCompanyId,
      );
    }
  }
}
