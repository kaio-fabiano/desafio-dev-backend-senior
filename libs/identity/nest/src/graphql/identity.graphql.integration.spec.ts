import { ApolloFederationDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { describe, expect, it } from 'vitest';

import {
  GraphqlOAuthResourceGuard,
  OAuthResourceService,
} from '@desafio-dev-backend-senior/source/platform-nest';

import { IdentityResolver } from './identity.resolver.ts';
import { UserLoader } from './user.loader.ts';
import { IdentityUserRepository } from './user.repository.ts';

const users = [{ id: 'user-1', email: 'buyer@identity.test' }];
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
    { provide: IdentityUserRepository, useValue: repository },
    { provide: UserLoader, useValue: new UserLoader(repository as never) },
    GraphqlOAuthResourceGuard,
    {
      provide: OAuthResourceService,
      useValue: {
        verify: async (request: Request) => ({
          scopes: request.headers.get('authorization')
            ? ['marketplace:read']
            : [],
        }),
      },
    },
    { provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard },
  ],
})
class IdentityGraphqlTestModule {}

describe('Identity GraphQL runtime', () => {
  it('executes the maintained federated schema through Nest resolver metadata @spec:AC-080 @spec:AC-228', async () => {
    const module = await Test.createTestingModule({
      imports: [IdentityGraphqlTestModule],
    }).compile();
    const app = module.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const result = await fetch(`http://127.0.0.1:${address.port}/graphql`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer allowed',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query:
          '{ user(id: "user-1") { email } users { edges { node { id } } } }',
      }),
    });

    expect(await result.json()).toEqual({
      data: {
        user: { email: 'buyer@identity.test' },
        users: { edges: [{ node: { id: 'user-1' } }] },
      },
    });
    const denied = await fetch(`http://127.0.0.1:${address.port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ users { edges { node { id } } } }' }),
    });
    const deniedBody = await denied.json();
    expect(deniedBody).toMatchObject({
      errors: [{ extensions: { code: 'FORBIDDEN' } }],
    });
    await app.close();
  });
});
