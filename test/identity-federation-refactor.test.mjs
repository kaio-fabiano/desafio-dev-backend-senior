import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const libraryRoot = 'libs/identity/nest/src';

test('AC-092: NestJS owns Identity Federation runtime dependencies @spec:AC-092', async () => {
  const [main, appModule, identityModule] = await Promise.all([
    readFile('apps/identity-subgraph/src/main.ts', 'utf8'),
    readFile('apps/identity-subgraph/src/app.module.ts', 'utf8'),
    readFile(`${libraryRoot}/identity.module.ts`, 'utf8'),
  ]);

  assert.match(
    main,
    /NestFactory\.create\(AppModule,\s*\{\s*bodyParser: false\s*\}\)/,
  );
  assert.doesNotMatch(
    main,
    /\bPool\b|createIdentityAuth|toBetterAuthRequest|auth\.handler|\.getHttpAdapter\(/,
  );
  assert.match(
    appModule,
    /from ['"]@desafio-dev-backend-senior\/source\/identity-nest['"]/,
  );
  assert.match(identityModule, /providers:/);
  assert.match(identityModule, /RegistrationService/);
  assert.match(identityModule, /IdentityResolver/);
});

test('AC-093: Better Auth uses injectable plugin factories and its NestJS integration @spec:AC-093', async () => {
  const [
    moduleSource,
    { BetterAuthFactory },
    { JwtPluginFactory },
    { OAuthProviderPluginFactory },
  ] = await Promise.all([
    readFile(`${libraryRoot}/auth/better-auth.module.ts`, 'utf8'),
    import(`../${libraryRoot}/auth/better-auth.factory.ts`),
    import(`../${libraryRoot}/auth/plugins/jwt-plugin.factory.ts`),
    import(`../${libraryRoot}/auth/plugins/oauth-provider-plugin.factory.ts`),
  ]);
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthAuthorizationCode: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
  };
  const factory = new BetterAuthFactory(
    new JwtPluginFactory(),
    new OAuthProviderPluginFactory(),
  );
  const auth = factory.create({
    database: memoryAdapter(database),
    baseURL: 'http://identity.test',
    secret: 'identity-refactor-test-secret-at-least-32-characters',
    seedAdminEmail: 'admin@identity.test',
  });

  assert.deepEqual(
    auth.options.plugins?.map((plugin) => plugin.id),
    ['jwt', 'oauth-provider'],
  );
  assert.match(
    moduleSource,
    /AuthModule as NestJSBetterAuth[\s\S]*NestJSBetterAuth\.forRootAsync/,
  );
  assert.match(moduleSource, /AuthService/);
});

test('AC-094: Identity reads and links Better Auth models without duplicate persistence @spec:AC-094', async () => {
  const [{ IdentityResolver }, { RegistrationService }] = await Promise.all([
    import(`../${libraryRoot}/graphql/identity.resolver.ts`),
    import(`../${libraryRoot}/auth/registration.service.ts`),
  ]);
  const users = [
    { id: 'u-1', email: 'buyer@example.test' },
    { id: 'u-2', email: 'supplier@example.test' },
  ];
  const calls = [];
  const adapter = {
    async findOne(input) {
      calls.push(input);
      return users.find((user) => user.id === input.where[0].value) ?? null;
    },
    async findMany(input) {
      calls.push(input);
      return users.slice(0, input.limit);
    },
  };
  const resolver = new IdentityResolver({
    instance: { $context: Promise.resolve({ adapter }) },
  });
  const context = { subject: 'u-1', scopes: ['marketplace:read'] };

  assert.deepEqual(await resolver.me(context), users[0]);
  assert.deepEqual(await resolver.user('u-2', context), users[1]);
  assert.equal((await resolver.users(1, undefined, context)).edges.length, 1);
  assert.deepEqual(
    calls.map(({ model }) => model),
    ['user', 'user', 'user'],
  );

  const linked = [];
  const registration = new RegistrationService({
    async createOrLink() {
      return { id: 'wp-44' };
    },
  });
  await registration.afterEmailSignUp({
    body: { email: 'buyer@example.test', name: 'Buyer', password: 'secret' },
    context: {
      returned: { user: users[0] },
      internalAdapter: {
        async linkAccount(account) {
          linked.push(account);
        },
      },
    },
  });
  assert.deepEqual(linked, [
    {
      accountId: 'wp-44',
      issuer: 'wordpress',
      providerId: 'wordpress',
      userId: 'u-1',
    },
  ]);
  await registration.afterEmailSignUp({
    headers: new Headers({ 'x-identity-bootstrap': '1' }),
    body: { email: 'admin@example.test', name: 'Admin', password: 'secret' },
    context: {
      returned: { user: { id: 'admin' } },
      internalAdapter: {
        async linkAccount() {
          throw new Error('Internal bootstrap must not link WordPress');
        },
      },
    },
  });

  const cleanup = [];
  const failedRegistration = new RegistrationService({
    async createOrLink() {
      throw new Error('WordPress unavailable');
    },
  });
  await assert.rejects(
    () =>
      failedRegistration.afterEmailSignUp({
        body: {
          email: 'failed@example.test',
          name: 'Failed',
          password: 'secret',
        },
        context: {
          returned: { user: { id: 'failed-user' } },
          internalAdapter: {
            async linkAccount() {},
            async deleteUserSessions(id) {
              cleanup.push(['sessions', id]);
            },
            async deleteAccounts(id) {
              cleanup.push(['accounts', id]);
            },
            async deleteUser(id) {
              cleanup.push(['user', id]);
            },
          },
        },
      }),
    /Registration could not be completed/,
  );
  assert.deepEqual(cleanup, [
    ['sessions', 'failed-user'],
    ['accounts', 'failed-user'],
    ['user', 'failed-user'],
  ]);

  const sources = await Promise.all(
    [
      `${libraryRoot}/graphql/identity.resolver.ts`,
      `${libraryRoot}/auth/registration.service.ts`,
    ].map((file) => readFile(file, 'utf8')),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /\bPostgresUserRepository\b|from ['"]pg['"]|select\s+.+\s+from\s+["']?user/i,
  );
});

test('AC-096: Identity Federation rejects sensitive operations without propagated scope @spec:AC-096', async () => {
  const { IdentityResolver } = await import(
    `../${libraryRoot}/graphql/identity.resolver.ts`
  );
  const resolver = new IdentityResolver({
    instance: {
      $context: Promise.resolve({
        adapter: {
          async findOne() {
            return { id: 'u-1', email: 'buyer@example.test' };
          },
          async findMany() {
            return [{ id: 'u-1', email: 'buyer@example.test' }];
          },
        },
      }),
    },
  });

  for (const context of [
    { subject: '', scopes: ['marketplace:read'] },
    { subject: 'u-1', scopes: [] },
  ]) {
    await assert.rejects(() => resolver.me(context), /access denied/);
    await assert.rejects(() => resolver.user('u-1', context), /access denied/);
    await assert.rejects(
      () => resolver.users(20, undefined, context),
      /access denied/,
    );
    await assert.rejects(
      () => resolver.resolveReference({ id: 'u-1' }, context),
      /access denied/,
    );
  }
});
