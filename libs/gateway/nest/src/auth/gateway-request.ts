import type { IncomingMessage } from 'node:http';

export declare class GatewayRequest {
  readonly headers: IncomingMessage['headers'];
  readonly method?: string;
  readonly rawHeaders: readonly string[];
  readonly url?: string;
  readonly originalUrl?: string;
}
