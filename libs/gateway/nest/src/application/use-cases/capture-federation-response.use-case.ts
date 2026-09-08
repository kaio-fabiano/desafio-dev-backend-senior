import { Injectable } from '@nestjs/common';

import type { FederationCapabilities } from '../dto/federation-capabilities.dto.ts';

@Injectable()
export class CaptureFederationResponseUseCase {
  execute(
    capabilities: FederationCapabilities,
    headers: ReadonlyMap<string, string | readonly string[]>,
  ): ReadonlyMap<string, string | readonly string[]> {
    if (!capabilities.responseSession) return new Map();

    const captured = new Map<string, string | readonly string[]>();
    for (const name of ['woocommerce-session', 'cart-token']) {
      const value = headers.get(name);
      if (value) captured.set(name, value);
    }
    const cookies = headers.get('set-cookie');
    if (cookies && (typeof cookies === 'string' || cookies.length > 0)) {
      captured.set('set-cookie', cookies);
    }
    return captured;
  }
}
