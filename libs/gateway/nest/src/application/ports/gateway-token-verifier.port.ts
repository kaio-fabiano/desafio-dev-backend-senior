import type { AuthenticationPrincipal } from '../dto/authentication-principal.dto.ts';
import type { GatewayAuthenticationRequest } from '../dto/gateway-authentication-request.dto.ts';

export abstract class GatewayTokenVerifierPort {
  abstract verifyToken(
    request: GatewayAuthenticationRequest,
  ): Promise<AuthenticationPrincipal>;
}
