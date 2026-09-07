import type { CommerceSessionHeaders } from '../dto/commerce-session-headers.dto.ts';
import type { GatewayAuthenticationRequest } from '../dto/gateway-authentication-request.dto.ts';
import { GatewayContext } from '../dto/gateway-context.dto.ts';
import type { CommerceCookiePort } from '../ports/commerce-cookie.port.ts';
import type { GatewayTokenVerifierPort } from '../ports/gateway-token-verifier.port.ts';

export class CreateGatewayContextUseCase {
  constructor(
    private readonly tokens: GatewayTokenVerifierPort,
    private readonly cookies: CommerceCookiePort,
  ) {}

  async execute(
    request: GatewayAuthenticationRequest,
  ): Promise<GatewayContext> {
    const principal = await this.tokens.verifyToken(request);
    const cookie = this.cookies.allowlisted(request.cookie?.trim());
    const woocommerceSession = request.woocommerceSession?.trim() || undefined;
    const cartToken = request.cartToken?.trim() || undefined;
    const sessionHeaders: CommerceSessionHeaders = {
      ...(cookie ? { cookie } : {}),
      ...(woocommerceSession
        ? { 'woocommerce-session': woocommerceSession }
        : {}),
      ...(cartToken ? { 'cart-token': cartToken } : {}),
    };

    return new GatewayContext(
      request.authorization,
      principal,
      request.requestId,
      sessionHeaders,
    );
  }
}
