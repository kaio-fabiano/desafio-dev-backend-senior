import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const libraryRoot = 'libs/identity/nest/src';

test('AC-092: NestJS owns Identity Federation runtime dependencies @spec:AC-092', async () => {
  const [main, appModule, identityModule, betterAuthModule] = await Promise.all(
    [
      readFile('apps/identity-subgraph/src/main.ts', 'utf8'),
      readFile('apps/identity-subgraph/src/app.module.ts', 'utf8'),
      readFile(`${libraryRoot}/identity.module.ts`, 'utf8'),
      readFile(`${libraryRoot}/better-auth/better-auth.module.ts`, 'utf8'),
    ],
  );

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
  assert.match(identityModule, /BetterAuthModule/);
  assert.doesNotMatch(identityModule, /RegistrationService/);
  assert.match(betterAuthModule, /RegistrationModule/);
  assert.match(identityModule, /IdentityResolver/);
});

test('AC-093: Better Auth uses direct plugins and its NestJS integration @spec:AC-093', async () => {
  const [moduleSource, { BetterAuthFactory }] = await Promise.all([
    readFile(`${libraryRoot}/better-auth/better-auth.module.ts`, 'utf8'),
    import(`../${libraryRoot}/better-auth/better-auth.factory.ts`),
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
  const factory = new BetterAuthFactory();
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

test('AC-094: Identity reads and links Better Auth models without duplicate persistence @spec:AC-094 @spec:AC-268', async () => {
  const [
    { IdentityResolver },
    { UserLoader },
    { RegistrationService },
    { IdentityBootstrap },
    { RegistrationCompensationService },
    { WordPressCustomerIdentityAdapter },
  ] = await Promise.all([
    import(`../${libraryRoot}/graphql/identity.resolver.ts`),
    import(`../${libraryRoot}/graphql/user.loader.ts`),
    import(`../${libraryRoot}/registration/registration.service.ts`),
    import(`../${libraryRoot}/registration/identity-bootstrap.ts`),
    import(
      `../${libraryRoot}/registration/registration-compensation.service.ts`
    ),
    import(
      `../${libraryRoot}/infrastructure/wordpress/wordpress-customer-identity.adapter.ts`
    ),
  ]);
  const users = [
    { id: 'u-1', email: 'buyer@example.test' },
    { id: 'u-2', email: 'supplier@example.test' },
  ];
  const repository = {
    async findByIds(ids) {
      return users.filter((user) => ids.includes(user.id));
    },
    async findPage(first) {
      const page = users.slice(0, first);
      return {
        edges: page.map((node) => ({ cursor: node.id, node })),
        pageInfo: {
          hasNextPage: users.length > first,
          hasPreviousPage: false,
          startCursor: page.at(0)?.id ?? null,
          endCursor: page.at(-1)?.id ?? null,
        },
      };
    },
  };
  const resolver = new IdentityResolver(repository, new UserLoader(repository));
  const context = { subject: 'u-1', scopes: ['marketplace:read'] };

  assert.deepEqual(await resolver.me(context.subject), users[0]);
  assert.deepEqual(await resolver.user('u-2', context), users[1]);
  assert.equal((await resolver.users(1, undefined, context)).edges.length, 1);

  const linked = [];
  const wordpress = {
    async createCustomer() {
      return { id: 'wp-44' };
    },
    async deleteCustomer() {
      return undefined;
    },
    async linkSubject() {
      return undefined;
    },
  };
  const registration = new RegistrationService(
    new WordPressCustomerIdentityAdapter(wordpress),
    new RegistrationCompensationService(wordpress),
  );
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
    headers: IdentityBootstrap.headers(),
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
  const unavailableWordPress = {
    async createCustomer() {
      throw new Error('WordPress unavailable');
    },
    async deleteCustomer() {
      return undefined;
    },
    async linkSubject() {
      return undefined;
    },
  };
  const failedRegistration = new RegistrationService(
    new WordPressCustomerIdentityAdapter(unavailableWordPress),
    new RegistrationCompensationService(unavailableWordPress),
  );
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
            async linkAccount() {
              return undefined;
            },
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
      `${libraryRoot}/registration/registration.service.ts`,
    ].map((file) => readFile(file, 'utf8')),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /\bPostgresUserRepository\b|from ['"]pg['"]|select\s+.+\s+from\s+["']?user/i,
  );
});

test('AC-263: Identity composes explicit adapters and delegates presentation to use cases @spec:AC-263 @spec:AC-268', async () => {
  const [
    accountAdapter,
    oauthAdapter,
    credentialsAdapter,
    userAdapter,
    wordpressAdapter,
    registration,
    resolver,
    oauthController,
    identityModule,
    registrationModule,
    oauthModule,
    appModule,
    main,
  ] = await Promise.all(
    [
      `${libraryRoot}/infrastructure/better-auth/better-auth-identity-account.adapter.ts`,
      `${libraryRoot}/infrastructure/oauth/better-auth-oauth-client-provisioning.adapter.ts`,
      `${libraryRoot}/infrastructure/oauth/environment-oauth-seed-credentials.adapter.ts`,
      `${libraryRoot}/infrastructure/persistence/better-auth-identity-user.adapter.ts`,
      `${libraryRoot}/infrastructure/wordpress/wordpress-customer-identity.adapter.ts`,
      `${libraryRoot}/registration/registration.service.ts`,
      `${libraryRoot}/graphql/identity.resolver.ts`,
      `${libraryRoot}/oauth-issuer/oauth-clients.controller.ts`,
      `${libraryRoot}/identity.module.ts`,
      `${libraryRoot}/registration/registration.module.ts`,
      `${libraryRoot}/oauth-issuer/oauth-issuer.module.ts`,
      'apps/identity-subgraph/src/app.module.ts',
      'apps/identity-subgraph/src/main.ts',
    ].map((file) => readFile(file, 'utf8')),
  );

  assert.match(accountAdapter, /implements IdentityAccountPort/);
  assert.match(oauthAdapter, /implements OAuthClientProvisioningPort/);
  assert.match(credentialsAdapter, /implements OAuthSeedCredentialsPort/);
  assert.match(userAdapter, /implements IdentityUserQueryPort/);
  assert.match(wordpressAdapter, /implements CustomerIdentityPort/);
  assert.match(registration, /RegisterIdentityUseCase/);
  assert.match(registration, /BetterAuthIdentityAccountAdapter/);
  assert.doesNotMatch(registration, /internalAdapter\.linkAccount/);
  assert.match(resolver, /ListIdentityUsersUseCase/);
  assert.match(resolver, /FindIdentityUsersUseCase/);
  assert.doesNotMatch(resolver, /IdentityUserRepository/);
  assert.match(oauthController, /OAuthClientProvisioningService/);
  assert.match(identityModule, /IdentityUserQueryPort/);
  assert.match(identityModule, /BetterAuthIdentityUserAdapter/);
  assert.match(registrationModule, /CustomerIdentityPort/);
  assert.match(oauthModule, /OAuthClientProvisioningPort/);
  assert.match(oauthModule, /OAuthSeedCredentialsPort/);
  assert.doesNotMatch(
    `${appModule}\n${main}`,
    /better-auth|WordPress|AuthService|IdentityUserQueryPort/,
  );
});

test('AC-096: Identity Federation rejects sensitive operations without propagated scope @spec:AC-096', async () => {
  const [resolver, guard, service] = await Promise.all([
    readFile(`${libraryRoot}/graphql/identity.resolver.ts`, 'utf8'),
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
      'utf8',
    ),
  ]);
  for (const operation of ['users', 'user', 'me', 'resolveReference']) {
    assert.match(
      resolver,
      new RegExp(
        `@RequireScopes\\(OAuthResources.marketplaceReadScope\\)[\\s\\S]*${operation}`,
      ),
    );
  }
  assert.match(
    guard,
    /this\.resources\.verify\(OAuthRequestAdapter\.toRequest\(context\.req\)\)/,
  );
  assert.match(guard, /assertScopes\(auth, scopes\)/);
  assert.match(service, /verifyAccessTokenRequest/);
  assert.doesNotMatch(service, /requiredScopes/);
});
