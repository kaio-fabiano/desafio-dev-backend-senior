import { GraphQLError } from 'graphql';
import { GatewayErrorMessages } from '../../application/gateway-error-messages.ts';

export class GatewayUnauthenticatedError {
  static create(): GraphQLError {
    return new GraphQLError(GatewayErrorMessages.unauthorized, {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}
