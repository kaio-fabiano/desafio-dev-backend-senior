import { ApolloFederationDriver } from '@nestjs/apollo';
import {
  type INestApplication,
  Module,
  type Provider,
  Scope,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { APP_GUARD, ContextIdFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  GraphqlOAuthResourceGuard,
  OAuthResourceService,
} from '@desafio-dev-backend-senior/source/platform-nest';

import { IdentityUserQueryPort } from '../application/ports/identity-user-query.port.ts';
import { FindIdentityUsersUseCase } from '../application/use-cases/find-identity-users.use-case.ts';
import { ListIdentityUsersUseCase } from '../application/use-cases/list-identity-users.use-case.ts';
import { IdentityModule } from '../identity.module.ts';
import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';
import { IdentityResolver } from './identity.resolver.ts';

const users = [
  { id: 'user-1', email: 'buyer@identity.test' },
  { id: 'user-2', email: 'supplier@identity.test' },
];
const repository = {
  async findByIds(ids: readonly string[]) {
    return users.filter(({ id }) => ids.includes(id));
  },
  async findPage() {
    return {
      edges: users.map((node) => ({ cursor: 'dXNlci0x', node })),
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: 'dXNlci0x',
        endCursor: 'dXNlci0x',
      },
    };
  },
};

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloFederationDriver,
      typePaths: ['libs/contracts/graphql/identity/schema.graphql'],
      fieldResolverEnhancers: ['guards'],
    }),
  ],
  providers: [
    IdentityResolver,
    {
      provide: ListIdentityUsersUseCase,
      useValue: new ListIdentityUsersUseCase(repository),
    },
    {
      provide: FindIdentityUsersUseCase,
      useValue: new FindIdentityUsersUseCase(repository),
    },
    GraphqlOAuthResourceGuard,
    {
      provide: OAuthResourceService,
      useValue: {
        verify: async (request: Request) => {
          const authorization = request.headers.get('authorization');
          if (authorization === 'Bearer admin') {
            return {
              audience: [],
              claims: {},
              scopes: ['identity:users:read'],
              subject: 'admin',
            };
          }
          return {
            audience: [],
            claims: {},
            scopes: authorization ? ['marketplace:read'] : [],
            subject: authorization === 'Bearer other' ? 'user-2' : 'user-1',
          };
        },
      },
    },
    { provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard },
    {
      provide: WordPressIdentityService,
      useValue: { findOrderReferences: async () => [] },
    },
  ],
})
class IdentityGraphqlTestModule {}

describe('Identity GraphQL runtime', () => {
  let app: INestApplication;
  let graphqlUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [IdentityGraphqlTestModule],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    graphqlUrl = `http://127.0.0.1:${address.port}/graphql`;
  });

  afterAll(() => app.close());

  async function execute(query: string, authorization?: string) {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        ...(authorization ? { authorization } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    return response.json();
  }

  it('executes the maintained federated schema through Nest resolver metadata @spec:AC-080 @spec:AC-228', async () => {
    await expect(
      execute(
        '{ user(id: "user-1") { email } users { edges { node { id } } } }',
        'Bearer admin',
      ),
    ).resolves.toEqual({
      data: {
        user: { email: 'buyer@identity.test' },
        users: {
          edges: [{ node: { id: 'user-1' } }, { node: { id: 'user-2' } }],
        },
      },
    });
    await expect(
      execute('{ users { edges { node { id } } } }'),
    ).resolves.toMatchObject({
      errors: [{ extensions: { code: 'FORBIDDEN' } }],
    });
  });

  it('restricts users to identity:users:read @spec:AC-309', async () => {
    await expect(
      execute('{ users { edges { node { id email } } } }', 'Bearer buyer'),
    ).resolves.toMatchObject({
      errors: [{ extensions: { code: 'FORBIDDEN' } }],
    });
    await expect(
      execute('{ users { edges { node { id email } } } }', 'Bearer admin'),
    ).resolves.toEqual({
      data: {
        users: {
          edges: [
            { node: { email: 'buyer@identity.test', id: 'user-1' } },
            { node: { email: 'supplier@identity.test', id: 'user-2' } },
          ],
        },
      },
    });
  });

  it('hides cross-user lookups like missing users while preserving self and me @spec:AC-310', async () => {
    await expect(
      execute('{ me { id } user(id: "user-1") { id email } }', 'Bearer buyer'),
    ).resolves.toEqual({
      data: {
        me: { id: 'user-1' },
        user: { email: 'buyer@identity.test', id: 'user-1' },
      },
    });

    const hidden = await execute(
      '{ user(id: "user-2") { id email } }',
      'Bearer buyer',
    );
    const missing = await execute(
      '{ user(id: "missing") { id email } }',
      'Bearer buyer',
    );
    expect(hidden).toEqual(missing);
    expect(hidden).toEqual({ data: { user: null } });

    await expect(
      execute(
        '{ _entities(representations: [{ __typename: "User", id: "user-2" }]) { ... on User { id } } }',
        'Bearer buyer',
      ),
    ).resolves.toEqual({ data: { _entities: [null] } });
    await expect(
      execute('{ user(id: "user-1") { id email } }', 'Bearer admin'),
    ).resolves.toEqual({
      data: {
        user: { email: 'buyer@identity.test', id: 'user-1' },
      },
    });
  });

  it('batches and caches with the production request-scoped provider @spec:AC-311', async () => {
    const productionProvider = (
      Reflect.getMetadata(
        MODULE_METADATA.PROVIDERS,
        IdentityModule,
      ) as Provider[]
    ).find(
      (provider) =>
        typeof provider === 'object' &&
        'provide' in provider &&
        provider.provide === FindIdentityUsersUseCase,
    );
    expect(productionProvider).toMatchObject({
      provide: FindIdentityUsersUseCase,
      scope: Scope.REQUEST,
      useClass: FindIdentityUsersUseCase,
    });
    const findByIds = vi.fn(async (ids: readonly string[]) =>
      users.filter(({ id }) => ids.includes(id)),
    );
    const module = await Test.createTestingModule({
      providers: [
        productionProvider as Provider,
        {
          provide: IdentityUserQueryPort,
          useValue: { findByIds },
        },
      ],
    }).compile();

    const firstRequest = await module.resolve(
      FindIdentityUsersUseCase,
      ContextIdFactory.create(),
    );
    const [first, second, repeated] = await Promise.all([
      firstRequest.load('user-1'),
      firstRequest.load('user-2'),
      firstRequest.load('user-1'),
    ]);
    const secondRequest = await module.resolve(
      FindIdentityUsersUseCase,
      ContextIdFactory.create(),
    );
    await secondRequest.load('user-1');

    expect([first?.id, second?.id, repeated?.id]).toEqual([
      'user-1',
      'user-2',
      'user-1',
    ]);
    expect(repeated).toBe(first);
    expect(findByIds).toHaveBeenNthCalledWith(1, ['user-1', 'user-2']);
    expect(findByIds).toHaveBeenNthCalledWith(2, ['user-1']);
    await module.close();
  });
});
