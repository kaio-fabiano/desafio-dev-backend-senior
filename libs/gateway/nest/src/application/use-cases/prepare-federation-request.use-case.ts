import { Inject, Injectable } from '@nestjs/common';

import type { FederationCapabilities } from '../dto/federation-capabilities.dto.ts';
import type { GatewayContext } from '../dto/gateway-context.dto.ts';
import { GatewayErrorMessages } from '../gateway-error-messages.ts';
import { CommerceCookiePort } from '../ports/commerce-cookie.port.ts';
import { WordPressCredentialPort } from '../ports/wordpress-credential.port.ts';

@Injectable()
export class PrepareFederationRequestUseCase {
  constructor(
    @Inject(CommerceCookiePort)
    private readonly cookies: CommerceCookiePort,
    @Inject(WordPressCredentialPort)
    private readonly wordpressCredentials: WordPressCredentialPort,
  ) {}

  async execute(
    capabilities: FederationCapabilities,
    context: GatewayContext | undefined,
  ): Promise<ReadonlyMap<string, string>> {
    const headers = new Map<string, string>();
    if (capabilities.origin) headers.set('origin', capabilities.origin);
    if (context?.requestId) headers.set('x-request-id', context.requestId);
    if (capabilities.bearer && context?.authorization) {
      headers.set('authorization', context.authorization);
    }
    if (capabilities.wordpressCredential) {
      if (!context?.principal.subject) {
        throw new Error(GatewayErrorMessages.unauthorized);
      }
      const credential = await this.wordpressCredentials.exchange(
        context.principal.subject,
      );
      headers.set('authorization', `Bearer ${credential}`);
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
