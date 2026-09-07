import { randomUUID } from 'node:crypto';

import { GatewayAuthenticationRequest } from '../../application/dto/gateway-authentication-request.dto.ts';
import type { GatewayRequest } from './gateway-request.dto.ts';

export class GatewayRequestAdapter {
  static trustedOrigin(value: string): string {
    const origin = new URL(value);
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
      throw new Error('Gateway origin must use HTTP or HTTPS');
    }
    return origin.origin;
  }

  static toAuthenticationRequest(
    request: GatewayRequest,
    origin: string,
  ): GatewayAuthenticationRequest {
    const converted = GatewayRequestAdapter.toRequest(request, origin);
    return new GatewayAuthenticationRequest(
      converted.headers.get('authorization') ?? '',
      converted.headers.get('cart-token') ?? undefined,
      converted.headers.get('cookie') ?? undefined,
      converted.headers.get('dpop') ?? undefined,
      converted.method,
      converted.headers.get('x-request-id') ?? randomUUID(),
      converted.url,
      converted.headers.get('woocommerce-session') ?? undefined,
    );
  }

  static toRequest(request: GatewayRequest, origin: string): Request {
    const headers = new Headers();
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index];
      const value = request.rawHeaders[index + 1];
      if (name && value !== undefined) headers.append(name, value);
    }
    const target = request.originalUrl ?? request.url ?? '/';
    if (
      !target.startsWith('/') ||
      target.startsWith('//') ||
      target.includes('\\')
    ) {
      throw new Error('Gateway request target must be an absolute path');
    }
    return new Request(new URL(target, origin), {
      headers,
      method: request.method ?? 'GET',
    });
  }
}
