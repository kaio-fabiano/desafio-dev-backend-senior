import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WpGraphqlCredentialAdapter } from './wp-graphql-credential.adapter.ts';

function adapter(siteToken = 'site-token') {
  return new WpGraphqlCredentialAdapter({
    get: (name: string, fallback?: string) =>
      ({
        WORDPRESS_GRAPHQL_URL: 'https://wordpress.test/graphql',
        WPGRAPHQL_SITE_TOKEN: siteToken,
      })[name] ?? fallback,
  } as ConfigService);
}

describe('WPGraphQL credential adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the verified subject through the native SITETOKEN provider', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        Response.json({ data: { login: { authToken: ' wordpress-bearer ' } } }),
      );
    vi.stubGlobal('fetch', fetch);

    await expect(adapter().exchange('buyer-1')).resolves.toBe(
      'wordpress-bearer',
    );
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://wordpress.test/graphql');
    expect(init?.headers).toEqual({
      'content-type': 'application/json',
      origin: 'https://wordpress.test',
      'x-wpgraphql-site-token': 'site-token',
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      variables: { input: { identity: 'buyer-1', provider: 'SITETOKEN' } },
    });
  });

  it.each([
    ['HTTP failure', new Response(null, { status: 502 })],
    ['GraphQL failure', Response.json({ errors: [{}] })],
    ['missing bearer', Response.json({ data: { login: null } })],
  ])('returns one sanitized error for %s', async (_case, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(adapter().exchange('buyer-1')).rejects.toThrow(
      'WordPress credential exchange failed',
    );
  });

  it('fails before transport when the site token is unavailable', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(adapter('').exchange('buyer-1')).rejects.toThrow(
      'WordPress credential exchange failed',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
