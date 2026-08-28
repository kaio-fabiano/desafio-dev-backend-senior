export {
  AuthContextFactory,
  createGatewayAuthMiddleware,
  type AuthContext,
} from './auth/auth-context.factory.ts';
export {
  GATEWAY_TOKEN_OPTIONS,
  TokenVerifierService,
  gatewayTokenOptions,
  type VerifyGatewayRequest,
  type VerifyOptions,
  verifyGatewayRequest,
} from './auth/token-verifier.service.ts';
export { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
export { GatewayAuthProvidersModule, GatewayModule } from './gateway.module.ts';
