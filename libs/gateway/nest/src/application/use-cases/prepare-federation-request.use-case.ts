import type { FederationCapabilities } from '../dto/federation-capabilities.dto.ts';
import type { GatewayContext } from '../dto/gateway-context.dto.ts';
import type { CommerceCookiePort } from '../ports/commerce-cookie.port.ts';

export class PrepareFederationRequestUseCase {
  constructor(private readonly cookies: CommerceCookiePort) {}

  execute(
    capabilities: FederationCapabilities,
    context: GatewayContext | undefined,
  ): ReadonlyMap<string, string> {
    const headers = new Map<string, string>();
    if (capabilities.origin) headers.set('origin', capabilities.origin);
    if (context?.requestId) headers.set('x-request-id', context.requestId);
    if (capabilities.bearer && context?.authorization) {
      headers.set('authorization', context.authorization);
    }
    if (!capabilities.requestSession) return headers;

    const cookie = this.cookies.allowlisted(context?.sessionHeaders?.cookie);
    if (cookie) headers.set('cookie', cookie);
    const session = context?.sessionHeaders?.['woocommerce-session'];
    if (session) headers.set('woocommerce-session', session);
    const cartToken = context?.sessionHeaders?.['cart-token'];
    if (cartToken) headers.set('cart-token', cartToken);
    return headers;
  }
}
