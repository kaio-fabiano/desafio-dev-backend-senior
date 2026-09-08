import type { OAuthHttpRequest } from '../infrastructure/http/oauth-http-request.ts';

export class OAuthRequestAdapter {
  static toRequest(request: OAuthHttpRequest): Request {
    const headers = new Headers();
    for (const [name, raw] of Object.entries(request.headers)) {
      for (const value of Array.isArray(raw) ? raw : raw ? [raw] : []) {
        headers.append(name, value);
      }
    }
    const protocol = request.protocol ?? 'http';
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error('OAuth request protocol must be HTTP or HTTPS');
    }
    const host =
      OAuthRequestAdapter.firstHeader(request.headers.host) ?? 'resource.local';
    const target = request.originalUrl ?? request.url ?? '/';
    if (!target.startsWith('/') || target.startsWith('//')) {
      throw new Error('OAuth request target must be an absolute path');
    }
    return new Request(new URL(target, `${protocol}://${host}`), {
      headers,
      method: request.method ?? 'GET',
    });
  }

  private static firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    const first = Array.isArray(value) ? value[0] : value?.split(',')[0];
    return first?.trim() || undefined;
  }
}
