import type { WordPressIdentityPort } from './wordpress-identity.port.ts';

export function createWordPressIdentityAdapter(
  endpoint: string,
  authorization: string,
): WordPressIdentityPort {
  return {
    async createOrLink(input) {
      const response = await fetch(new URL('/wp-json/wp/v2/users', endpoint), {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: input.email,
          name: input.name,
          username: input.email.split('@')[0],
        }),
      });
      if (!response.ok) throw new Error(`WordPress identity failed: ${response.status}`);
      const user = (await response.json()) as { id: string | number };
      return { id: String(user.id) };
    },
  };
}
