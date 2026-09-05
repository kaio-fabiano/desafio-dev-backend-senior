import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WordPressIdentityService } from './wordpress-identity.service.ts';
import {
  type WordPressConfiguration,
  WORDPRESS_CONFIGURATION,
  wordpressConfigurationProvider,
} from './wordpress.config.ts';

const configurationFactory = (
  wordpressConfigurationProvider as FactoryProvider<WordPressConfiguration>
).useFactory as (config: ConfigService) => WordPressConfiguration;

const configuration: WordPressConfiguration = {
  endpoint: 'https://wordpress.test',
  registrarIdentity: 'identity-registrar',
  siteToken: 'site-token',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function config(values: Record<string, string>): ConfigService {
  return {
    get: vi.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

function query(init?: RequestInit): string {
  return (JSON.parse(String(init?.body)) as { query: string }).query;
}

describe('WordPress configuration', () => {
  it('reads and validates GraphQL registration settings through ConfigService @spec:AC-233 @spec:AC-238', () => {
    const settings = configurationFactory(
      config({
        NODE_ENV: 'production',
        WORDPRESS_IDENTITY_REGISTRAR: 'registrar',
        WORDPRESS_URL: 'https://wordpress.test',
        WPGRAPHQL_SITE_TOKEN: 'site-token',
      }),
    );

    expect(settings).toEqual({
      endpoint: 'https://wordpress.test',
      registrarIdentity: 'registrar',
      siteToken: 'site-token',
    });
  });

  it('rejects a missing production site token @spec:AC-233 @spec:AC-238', () => {
    expect(() =>
      configurationFactory(
        config({
          NODE_ENV: 'production',
          WORDPRESS_URL: 'https://wordpress.test',
        }),
      ),
    ).toThrow(
      expect.objectContaining({ code: 'WORDPRESS_CONFIGURATION_INVALID' }),
    );
  });
});

describe('WordPressIdentityService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses only named GraphQL operations for the registration lifecycle @spec:AC-238', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        response({
          data: { registerCustomer: { customer: { id: 'dXNlcjo0Nw==' } } },
        }),
      )
      .mockResolvedValueOnce(
        response({ data: { login: { authToken: 'registrar-token' } } }),
      )
      .mockResolvedValueOnce(
        response({
          data: { updateCustomer: { customer: { id: 'dXNlcjo0Nw==' } } },
        }),
      )
      .mockResolvedValueOnce(
        response({ data: { login: { authToken: 'registrar-token' } } }),
      )
      .mockResolvedValueOnce(
        response({ data: { deleteUser: { deletedId: 'dXNlcjo0Nw==' } } }),
      );
    vi.stubGlobal('fetch', fetch);
    const wordpress = new WordPressIdentityService(configuration);

    const customer = await wordpress.createCustomer({
      email: 'buyer@example.test',
      name: 'Buyer',
      password: 'secret-password',
    });
    await wordpress.linkSubject(customer.id, 'better-auth-user');
    await wordpress.deleteCustomer(customer.id);

    expect(customer).toEqual({ id: 'dXNlcjo0Nw==' });
    for (const [url, init] of fetch.mock.calls) {
      expect(new URL(url).pathname).toBe('/graphql');
      expect(init?.method).toBe('POST');
    }
    expect(fetch.mock.calls.map(([, init]) => query(init))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('mutation RegisterIdentityCustomer'),
        expect.stringContaining('mutation LoginIdentityRegistrar'),
        expect.stringContaining('mutation LinkIdentitySubject'),
        expect.stringContaining('mutation DeleteIdentityCustomer'),
      ]),
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      'content-type': 'application/json',
      origin: 'https://wordpress.test',
      'x-wpgraphql-site-token': 'site-token',
    });
    expect(fetch.mock.calls[2]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer registrar-token',
    });
  });

  it('maps an existing native customer to the registration conflict @spec:AC-234', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          errors: [
            {
              message:
                'An account is already registered with buyer@example.test.',
            },
          ],
        }),
      ),
    );

    await expect(
      new WordPressIdentityService(configuration).createCustomer({
        email: 'buyer@example.test',
        name: 'Buyer',
        password: 'secret-password',
      }),
    ).rejects.toMatchObject({ code: 'WORDPRESS_IDENTITY_ALREADY_EXISTS' });
  });

  it.each([
    ['HTTP failure', response({}, 502)],
    ['GraphQL failure', response({ errors: [{ message: 'failed' }] })],
    ['missing customer', response({ data: { registerCustomer: null } })],
  ])(
    'reports a typed create failure for %s @spec:AC-234',
    async (_case, reply) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply));

      await expect(
        new WordPressIdentityService(configuration).createCustomer({
          email: 'buyer@example.test',
          name: 'Buyer',
          password: 'secret-password',
        }),
      ).rejects.toMatchObject({ code: 'WORDPRESS_CREATE_FAILED' });
    },
  );

  it.each([
    ['link', 'linkSubject', 'WORDPRESS_LINK_FAILED'],
    ['delete', 'deleteCustomer', 'WORDPRESS_DELETE_FAILED'],
  ] as const)(
    'reports a typed %s failure when registrar login fails @spec:AC-234',
    async (_case, method, code) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(response({ errors: [{ message: 'failed' }] })),
      );
      const wordpress = new WordPressIdentityService(configuration);

      const operation =
        method === 'linkSubject'
          ? wordpress.linkSubject('customer-id', 'better-auth-user')
          : wordpress.deleteCustomer('customer-id');
      await expect(operation).rejects.toMatchObject({ code });
    },
  );

  it.each([
    [
      'link GraphQL error',
      'linkSubject',
      response({ errors: [{ message: 'link failed' }] }),
      'WORDPRESS_LINK_FAILED',
    ],
    [
      'link identity mismatch',
      'linkSubject',
      response({
        data: { updateCustomer: { customer: { id: 'another-customer' } } },
      }),
      'WORDPRESS_LINK_FAILED',
    ],
    [
      'delete GraphQL error',
      'deleteCustomer',
      response({ errors: [{ message: 'delete failed' }] }),
      'WORDPRESS_DELETE_FAILED',
    ],
    [
      'delete identity mismatch',
      'deleteCustomer',
      response({ data: { deleteUser: { deletedId: 'another-customer' } } }),
      'WORDPRESS_DELETE_FAILED',
    ],
  ] as const)(
    'reports a typed failure for %s @spec:AC-234',
    async (_case, method, operationResponse, code) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(
          response({ data: { login: { authToken: 'registrar-token' } } }),
        )
        .mockResolvedValueOnce(operationResponse);
      vi.stubGlobal('fetch', fetch);
      const wordpress = new WordPressIdentityService(configuration);

      const operation =
        method === 'linkSubject'
          ? wordpress.linkSubject('customer-id', 'better-auth-user')
          : wordpress.deleteCustomer('customer-id');

      await expect(operation).rejects.toMatchObject({ code });
    },
  );

  it('is resolved with its configuration by the Nest container @spec:AC-233', async () => {
    const module = await Test.createTestingModule({
      providers: [
        WordPressIdentityService,
        { provide: WORDPRESS_CONFIGURATION, useValue: configuration },
      ],
    }).compile();

    expect(module.get(WordPressIdentityService)).toBeInstanceOf(
      WordPressIdentityService,
    );

    await module.close();
  });
});
