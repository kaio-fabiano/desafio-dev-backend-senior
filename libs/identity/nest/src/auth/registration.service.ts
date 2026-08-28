import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AfterHook,
  Hook,
  type AuthHookContext,
} from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';

export type WordPressIdentity = {
  createOrLink(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: string }>;
};

export const WORDPRESS_IDENTITY = Symbol('WORDPRESS_IDENTITY');

export const wordpressIdentityProvider: Provider = {
  provide: WORDPRESS_IDENTITY,
  useFactory: (): WordPressIdentity => ({
    async createOrLink(input) {
      const endpoint = process.env.WORDPRESS_URL ?? 'http://wordpress';
      const consumerKey = process.env.WOO_CONSUMER_KEY ?? '';
      const consumerSecret = process.env.WOO_CONSUMER_SECRET ?? '';
      if (
        process.env.NODE_ENV === 'production' &&
        (!consumerKey || !consumerSecret)
      ) {
        throw new Error(
          'WOO_CONSUMER_KEY and WOO_CONSUMER_SECRET are required in production',
        );
      }
      const headers = {
        authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
        'content-type': 'application/json',
        ...(new URL(endpoint).protocol === 'http:'
          ? { 'x-forwarded-proto': 'https' }
          : {}),
      };

      async function findByEmail() {
        const search = new URL('/wp-json/wc/v3/customers', endpoint);
        search.searchParams.set('email', input.email);
        const lookup = await fetch(search, { headers });
        if (!lookup.ok) {
          throw new Error(`WordPress identity lookup failed: ${lookup.status}`);
        }
        const [existing] = (await lookup.json()) as Array<{
          id: string | number;
        }>;
        return existing ? { id: String(existing.id) } : null;
      }

      const existing = await findByEmail();
      if (existing) return { id: String(existing.id) };

      const response = await fetch(
        new URL('/wp-json/wc/v3/customers', endpoint),
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
        const raced = await findByEmail();
        if (raced) return raced;
        throw new Error(`WordPress identity failed: ${response.status}`);
      }
      const created = (await response.json()) as { id: string | number };
      return { id: String(created.id) };
    },
  }),
};

type SignUpResult = { user?: { id: string } };
type SignUpInput = { email?: string; name?: string; password?: string };

export class RegistrationService {
  constructor(private readonly wordpress: WordPressIdentity) {}

  async afterEmailSignUp(context: AuthHookContext) {
    if (context.headers?.get('x-identity-bootstrap') === '1') return;
    const input = context.body as SignUpInput | undefined;
    const result = await this.signUpResult(context.context.returned);
    if (!input?.email || !input.name || !input.password || !result.user) return;

    const identity = context.context.internalAdapter;
    try {
      const account = await this.wordpress.createOrLink({
        email: input.email,
        name: input.name,
        password: input.password,
      });
      await identity.linkAccount({
        accountId: account.id,
        issuer: 'wordpress',
        providerId: 'wordpress',
        userId: result.user.id,
      });
    } catch (cause) {
      await identity.deleteUserSessions(result.user.id);
      await identity.deleteAccounts(result.user.id);
      await identity.deleteUser(result.user.id).catch(() => undefined);
      throw new APIError('SERVICE_UNAVAILABLE', {
        cause,
        code: 'WORDPRESS_IDENTITY_LINK_FAILED',
        message: 'Registration could not be completed',
      });
    }
  }

  private async signUpResult(returned: unknown): Promise<SignUpResult> {
    if (returned instanceof Response) {
      return returned.ok
        ? ((await returned.clone().json()) as SignUpResult)
        : {};
    }
    return (returned ?? {}) as SignUpResult;
  }
}

Injectable()(RegistrationService);
Hook()(RegistrationService);
Inject(WORDPRESS_IDENTITY)(RegistrationService, undefined, 0);
AfterHook('/sign-up/email')(
  RegistrationService.prototype,
  'afterEmailSignUp',
  Object.getOwnPropertyDescriptor(
    RegistrationService.prototype,
    'afterEmailSignUp',
  )!,
);
