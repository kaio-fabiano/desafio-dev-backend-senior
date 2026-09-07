import { GraphQLError } from 'graphql';

export class GatewayUnauthenticatedError {
  static create(): GraphQLError {
    return new GraphQLError('Unauthorized', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}
