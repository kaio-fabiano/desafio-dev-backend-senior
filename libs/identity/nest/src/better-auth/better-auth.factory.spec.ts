import type { AuthService } from '@thallesp/nestjs-better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BetterAuthFactory,
  type IdentityAuth,
  IdentityDatabasePool,
} from './better-auth.factory.ts';
import { OAuthClientProvisioningService } from '../oauth-issuer/oauth-client-provisioning.service.ts';
import {
  DELEGATED_OAUTH_SCOPES,
  OAUTH_RESOURCES,
} from '../oauth-issuer/oauth-resources.ts';

const createMemoryDatabase = () =>
  memoryAdapter({
    account: [],
    jwks: [],
    oauthAccessToken: [],
    oauthAuthorizationCode: [],
    oauthClient: [],
    oauthClientResource: [],
    oauthConsent: [],
    oauthRefreshToken: [],
    oauthResource: [],
    session: [],
    user: [],
    verification: [],
  });

describe('BetterAuthFactory', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('configures the supported Nest Better Auth instance and shared delegated resource scopes @spec:AC-227', async () => {
    const auth = new BetterAuthFactory().create({
      baseURL: 'https://identity.test',
      database: createMemoryDatabase(),
      issuer: 'https://identity.test/api/auth',
      secret: 'identity-test-secret-with-at-least-32-characters',
    });
    const oauth = auth.options.plugins?.find(
      (plugin) => plugin.id === 'oauth-provider',
    );

    expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual([
      'jwt',
      'oauth-provider',
    ]);
    expect(oauth?.options?.resources).toEqual(
      Object.values(OAUTH_RESOURCES).map((identifier) => ({
        allowedScopes: [...DELEGATED_OAUTH_SCOPES],
        identifier,
        signingAlgorithm: 'ES256',
      })),
    );
    expect(oauth?.options?.clientRegistrationDefaultResources).toEqual(
      Object.values(OAUTH_RESOURCES),
    );
    const privileges = oauth?.options?.clientPrivileges as unknown as (input: {
      user?: { email: string };
    }) => Promise<boolean>;
    await expect(
      privileges({ user: { email: 'admin@marketplace.local' } }),
    ).resolves.toBe(true);
    await expect(
      privileges({ user: { email: 'buyer@example.test' } }),
    ).resolves.toBe(false);
    await expect(privileges({})).resolves.toBe(false);
  });

  it('uses identity environment configuration and normalizes trusted origins', () => {
    vi.stubEnv('IDENTITY_BASE_URL', 'https://identity.example.test');
    vi.stubEnv(
      'IDENTITY_TRUSTED_ORIGINS',
      ' https://gateway.example.test, ,https://admin.example.test ',
    );
    vi.stubEnv('OAUTH_ISSUER', 'https://issuer.example.test');
    vi.stubEnv('SEED_ADMIN_EMAIL', 'seed@example.test');
    const auth = new BetterAuthFactory().create({
      database: createMemoryDatabase(),
      secret: 'identity-test-secret-with-at-least-32-characters',
    });

    expect(auth.options.baseURL).toBe('https://identity.example.test');
    expect(auth.options.trustedOrigins).toEqual([
      'https://gateway.example.test',
      'https://admin.example.test',
    ]);
    const jwtPlugin = auth.options.plugins?.find(
      (plugin) => plugin.id === 'jwt',
    );
    expect(jwtPlugin?.options?.jwt).toMatchObject({
      issuer: 'https://issuer.example.test',
    });
  });

  it('owns and disposes its internal PostgreSQL pool once @spec:AC-227', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'BETTER_AUTH_SECRET',
      'production-secret-with-at-least-32-characters',
    );
    const end = vi
      .spyOn(Pool.prototype, 'end')
      .mockImplementation(async () => undefined);
    const pools = new IdentityDatabasePool();

    const database = pools.connection;
    expect(pools.connection).toBe(database);
    await pools.onModuleDestroy();
    await pools.onModuleDestroy();

    expect(database.options.ssl).toEqual({ rejectUnauthorized: true });
    expect(end).toHaveBeenCalledOnce();
  });

  it.each([
    ['test', undefined, undefined],
    ['production', 'false', undefined],
  ])(
    'does not require PostgreSQL TLS in %s mode with override %s',
    async (environment, databaseSsl, expected) => {
      vi.stubEnv('NODE_ENV', environment);
      if (databaseSsl) vi.stubEnv('DATABASE_SSL', databaseSsl);
      const end = vi
        .spyOn(Pool.prototype, 'end')
        .mockImplementation(async () => undefined);
      const pools = new IdentityDatabasePool();

      expect(
        (pools.connection as Pool & { options: { ssl?: unknown } }).options.ssl,
      ).toBe(expected);
      await pools.onModuleDestroy();
      expect(end).toHaveBeenCalledOnce();
    },
  );

  it('does not acquire an internal pool when its caller supplies a database', async () => {
    const pools = new IdentityDatabasePool();
    const end = vi
      .spyOn(Pool.prototype, 'end')
      .mockImplementation(async () => undefined);
    const factory = new BetterAuthFactory(pools);

    factory.create({
      database: createMemoryDatabase(),
      secret: 'identity-test-secret-with-at-least-32-characters',
    });

    expect(end).not.toHaveBeenCalled();
    await pools.onModuleDestroy();
    expect(end).not.toHaveBeenCalled();
  });

  it('reports missing production secrets as typed configuration failures', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', '');

    expect(() => new BetterAuthFactory().create()).toThrow(
      expect.objectContaining({ code: 'BETTER_AUTH_SECRET_REQUIRED' }),
    );
  });
});

type BootstrapAdapter = {
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  runMigrations: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function bootstrapWith(
  adapter: BootstrapAdapter,
  api: Record<string, unknown> = {},
) {
  const instance = {
    $context: Promise.resolve({
      adapter,
      runMigrations: adapter.runMigrations,
    }),
  };
  const auth = {
    api,
    instance,
  } as unknown as AuthService<IdentityAuth>;
  return new OAuthClientProvisioningService(auth);
}

function existingClientsAdapter(): BootstrapAdapter {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findMany: vi
      .fn()
      .mockResolvedValue(
        Object.values(OAUTH_RESOURCES).map((resourceId) => ({ resourceId })),
      ),
    findOne: vi.fn().mockImplementation(({ model, where }) => {
      if (model !== 'oauthClient') return null;
      const softwareId = where[0]?.value;
      return { clientId: `${softwareId}-client` };
    }),
    runMigrations: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe('OAuthClientProvisioningService', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SEED_ADMIN_PASSWORD', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('coalesces concurrent bootstrap and needs no password for existing clients @spec:AC-227', async () => {
    const adapter = existingClientsAdapter();
    let releaseMigration: (() => void) | undefined;
    adapter.runMigrations.mockImplementation(
      () => new Promise<void>((resolve) => (releaseMigration = resolve)),
    );
    const bootstrap = bootstrapWith(adapter);

    const first = bootstrap.onApplicationBootstrap();
    const second = bootstrap.onApplicationBootstrap();
    await vi.waitFor(() =>
      expect(adapter.runMigrations).toHaveBeenCalledOnce(),
    );
    releaseMigration?.();
    await Promise.all([first, second]);
    await bootstrap.onApplicationBootstrap();

    expect(adapter.findOne).toHaveBeenCalledTimes(2);
    expect(bootstrap.clientIds).toEqual({
      gateway: 'identity-gateway-client',
      mcp: 'apollo-mcp-client',
    });
  });

  it('seeds idempotent PKCE clients with every delegated resource @spec:AC-063 @spec:AC-081 @spec:AC-228', async () => {
    vi.stubEnv('SEED_ADMIN_EMAIL', 'seed@identity.test');
    vi.stubEnv('SEED_ADMIN_PASSWORD', 'seed-password-at-least-32-characters');
    const factory = new BetterAuthFactory();
    const auth = factory.create({
      baseURL: 'http://identity.test',
      database: createMemoryDatabase(),
      issuer: 'https://identity.test/api/auth',
      secret: 'identity-test-secret-with-at-least-32-characters',
    });
    const bootstrap = new OAuthClientProvisioningService({
      api: auth.api,
      instance: auth,
    } as unknown as AuthService<IdentityAuth>);
    const context = await auth.$context;
    vi.spyOn(context, 'runMigrations').mockResolvedValue(undefined);

    await bootstrap.onApplicationBootstrap();
    const first = bootstrap.clientIds;
    await bootstrap.onApplicationBootstrap();
    const clients = await context.adapter.findMany<{
      clientId: string;
      grantTypes: string[];
      requirePKCE: boolean;
      scopes: string[];
    }>({ model: 'oauthClient' });
    const links = await context.adapter.findMany({
      model: 'oauthClientResource',
    });

    expect(bootstrap.clientIds).toEqual(first);
    expect(clients).toHaveLength(2);
    expect(clients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: first.gateway,
          grantTypes: ['authorization_code'],
          requirePKCE: true,
          scopes: ['openid', 'profile', ...DELEGATED_OAUTH_SCOPES],
        }),
        expect.objectContaining({
          clientId: first.mcp,
          grantTypes: ['authorization_code'],
          requirePKCE: true,
          scopes: ['openid', 'profile', ...DELEGATED_OAUTH_SCOPES],
        }),
      ]),
    );
    expect(links).toHaveLength(10);
  });

  it('does not publish partial clients and retries after a failed seed', async () => {
    vi.stubEnv(
      'SEED_ADMIN_PASSWORD',
      'seed-password-with-at-least-32-characters',
    );
    const adapter = existingClientsAdapter();
    let mcpAttempts = 0;
    adapter.findOne.mockImplementation(({ model, where }) => {
      if (model === 'user') return { id: 'admin' };
      const softwareId = where[0]?.value;
      if (softwareId === 'identity-gateway') {
        return { clientId: 'gateway-client' };
      }
      mcpAttempts += 1;
      return mcpAttempts === 1 ? null : { clientId: 'mcp-client' };
    });
    const signInEmail = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: [
          ['set-cookie', 'session=one; Path=/; HttpOnly'],
          ['set-cookie', 'session-data=two; Path=/; HttpOnly'],
        ],
      }),
    );
    const adminCreateOAuthClient = vi
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'));
    const bootstrap = bootstrapWith(adapter, {
      adminCreateOAuthClient,
      signInEmail,
    });

    await expect(bootstrap.onApplicationBootstrap()).rejects.toThrow(
      'database unavailable',
    );
    expect(() => bootstrap.clientIds).toThrow(
      expect.objectContaining({ code: 'OAUTH_CLIENTS_NOT_READY' }),
    );
    await bootstrap.onApplicationBootstrap();

    expect(bootstrap.clientIds).toEqual({
      gateway: 'gateway-client',
      mcp: 'mcp-client',
    });
  });

  it('passes every Better Auth session cookie to client creation', async () => {
    vi.stubEnv(
      'SEED_ADMIN_PASSWORD',
      'seed-password-with-at-least-32-characters',
    );
    const adapter = existingClientsAdapter();
    adapter.findOne.mockImplementation(({ model, where }) => {
      if (model === 'user') return { id: 'admin' };
      return where[0]?.value === 'identity-gateway'
        ? null
        : { clientId: 'mcp-client' };
    });
    const signInEmail = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: [
          ['set-cookie', 'session=one; Path=/; HttpOnly'],
          ['set-cookie', 'session-data=two; Path=/; HttpOnly'],
        ],
      }),
    );
    const adminCreateOAuthClient = vi
      .fn()
      .mockResolvedValue({ client_id: 'gateway-client' });
    const bootstrap = bootstrapWith(adapter, {
      adminCreateOAuthClient,
      signInEmail,
    });

    await bootstrap.onApplicationBootstrap();

    expect(adminCreateOAuthClient).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({}),
      }),
    );
    const [{ headers }] = adminCreateOAuthClient.mock.calls[0] as [
      { headers: Headers },
    ];
    expect(headers.get('cookie')).toBe('session=one; session-data=two');
  });

  it('adds missing resource links to an existing OAuth client', async () => {
    const adapter = existingClientsAdapter();
    adapter.findMany.mockResolvedValue([
      { resourceId: OAUTH_RESOURCES.gateway },
    ]);
    const bootstrap = bootstrapWith(adapter);

    await bootstrap.onApplicationBootstrap();

    expect(adapter.create).toHaveBeenCalledTimes(
      (Object.values(OAUTH_RESOURCES).length - 1) * 2,
    );
    expect(adapter.create).toHaveBeenCalledWith({
      model: 'oauthClientResource',
      data: expect.objectContaining({
        clientId: 'identity-gateway-client',
        resourceId: OAUTH_RESOURCES.identity,
      }),
    });
  });

  it('requires the seed password only when a client must be created', async () => {
    const adapter = existingClientsAdapter();
    adapter.findOne.mockResolvedValueOnce(null);
    const bootstrap = bootstrapWith(adapter);

    await expect(bootstrap.onApplicationBootstrap()).rejects.toMatchObject({
      code: 'SEED_ADMIN_PASSWORD_REQUIRED',
    });
  });

  it('signs up the seed administrator through the bootstrap-only path', async () => {
    vi.stubEnv('SEED_ADMIN_EMAIL', 'seed@example.test');
    vi.stubEnv(
      'SEED_ADMIN_PASSWORD',
      'seed-password-with-at-least-32-characters',
    );
    const adapter = existingClientsAdapter();
    adapter.findOne.mockImplementation(({ model, where }) => {
      if (model === 'user') return null;
      return where[0]?.value === 'identity-gateway'
        ? null
        : { clientId: 'mcp-client' };
    });
    const signUpEmail = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { 'set-cookie': 'session=one; Path=/; HttpOnly' },
        status: 200,
      }),
    );
    const adminCreateOAuthClient = vi
      .fn()
      .mockResolvedValue({ client_id: 'gateway-client' });
    const bootstrap = bootstrapWith(adapter, {
      adminCreateOAuthClient,
      signUpEmail,
    });

    await bootstrap.onApplicationBootstrap();

    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        email: 'seed@example.test',
        name: 'Identity client seed',
        password: 'seed-password-with-at-least-32-characters',
      },
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(adminCreateOAuthClient).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          scope: `openid profile ${DELEGATED_OAUTH_SCOPES.join(' ')}`,
        }),
      }),
    );
  });

  it('reports an unsuccessful Better Auth seed response as a typed failure', async () => {
    vi.stubEnv(
      'SEED_ADMIN_PASSWORD',
      'seed-password-with-at-least-32-characters',
    );
    const adapter = existingClientsAdapter();
    adapter.findOne.mockImplementation(({ model, where }) => {
      if (model === 'user') return { id: 'admin' };
      return where[0]?.value === 'identity-gateway'
        ? null
        : { clientId: 'mcp-client' };
    });
    const bootstrap = bootstrapWith(adapter, {
      signInEmail: vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 401 })),
    });

    await expect(bootstrap.onApplicationBootstrap()).rejects.toMatchObject({
      code: 'OAUTH_CLIENT_SEED_FAILED',
      message: 'Identity client seed failed: 401',
    });
  });
});
