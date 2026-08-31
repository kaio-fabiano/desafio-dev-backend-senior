import type { WordPressIdentityPort } from './wordpress-identity.port.ts';

export function createWordPressIdentityAdapter({
  endpoint,
  consumerKey,
  consumerSecret,
  request = fetch,
}: {
  endpoint: string;
  consumerKey: string;
  consumerSecret: string;
  request?: typeof fetch;
}): WordPressIdentityPort {
  const headers = {
    authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
    'content-type': 'application/json',
    ...(new URL(endpoint).protocol === 'http:'
      ? { 'x-forwarded-proto': 'https' }
      : {}),
  };

  function authenticatedUrl(path: string) {
    return new URL(path, endpoint);
  }

  async function findByEmail(email: string) {
    const url = authenticatedUrl('/wp-json/wc/v3/customers');
    url.searchParams.set('email', email);
    const response = await request(url, { headers });
    if (!response.ok)
      throw new Error(`WordPress identity lookup failed: ${response.status}`);
    const [user] = (await response.json()) as Array<{
      id: string | number;
    }>;
    return user ? { id: String(user.id) } : null;
  }

  return {
    async createOrLink(input) {
      const existing = await findByEmail(input.email);
      if (existing) return existing;

      const response = await request(
        authenticatedUrl('/wp-json/wc/v3/customers'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: input.email,
            first_name: input.name,
            password: input.password,
          }),
        },
      );
      if (!response.ok) {
        const raced = await findByEmail(input.email);
        if (raced) return raced;
        throw new Error(`WordPress identity failed: ${response.status}`);
      }
      const user = (await response.json()) as { id: string | number };
      return { id: String(user.id) };
    },
  };
}
