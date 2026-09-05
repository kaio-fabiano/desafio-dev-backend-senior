import type { IncomingMessage } from 'node:http';

export type GatewayRequest = Pick<
  IncomingMessage,
  'headers' | 'method' | 'rawHeaders' | 'url'
> & { originalUrl?: string };

export function trustedGatewayOrigin(value: string): string {
  const origin = new URL(value);
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    throw new Error('Gateway origin must use HTTP or HTTPS');
  }
  return origin.origin;
}

export function toGatewayRequest(
  request: GatewayRequest,
  origin: string,
): Request {
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
  const url = new URL(target, origin);
  return new Request(url, {
    headers,
    method: request.method ?? 'GET',
  });
}
