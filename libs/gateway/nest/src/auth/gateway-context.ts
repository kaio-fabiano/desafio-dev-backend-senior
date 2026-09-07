import type { AuthenticationPrincipal } from './authentication-principal.ts';
import type { CommerceSessionHeaders } from './commerce-session-headers.ts';

export declare class GatewayContext {
  readonly [key: string]: unknown;
  readonly [key: symbol]: unknown;
  readonly authorization: string;
  readonly principal: AuthenticationPrincipal;
  readonly requestId: string;
  readonly sessionHeaders: CommerceSessionHeaders;
  readonly setResponseHeader?: (name: string, value: string | string[]) => void;
}
