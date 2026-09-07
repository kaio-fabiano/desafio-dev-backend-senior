import type { AuthenticationPrincipal } from './authentication-principal.dto.ts';
import type { CommerceSessionHeaders } from './commerce-session-headers.dto.ts';

export class GatewayContext {
  readonly [key: string]: unknown;
  readonly [key: symbol]: unknown;

  constructor(
    readonly authorization: string,
    readonly principal: AuthenticationPrincipal,
    readonly requestId: string,
    readonly sessionHeaders: CommerceSessionHeaders,
    readonly setResponseHeader?: (
      name: string,
      value: string | string[],
    ) => void,
  ) {}
}
