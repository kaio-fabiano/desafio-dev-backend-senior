import {
  GraphqlOAuthResourceGuard,
  OAuthResourceModule,
} from '@desafio-dev-backend-senior/source/platform-nest';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { Pool } from 'pg';

import { createIdentitySchema } from './identity-schema.ts';
import { IdentityResolver } from './identity.resolver.ts';
import { PostgresUserRepository } from './postgres-user.repository.ts';

export class IdentityModule {}

Module({
  imports: [
    OAuthResourceModule.register({
      audience:
        process.env.IDENTITY_OAUTH_AUDIENCE ??
        'https://identity.marketplace.local',
      issuer:
        process.env.OAUTH_ISSUER ?? 'http://identity-subgraph:3001/api/auth',
      jwksUrl:
        process.env.IDENTITY_JWKS_URL ??
        'http://identity-subgraph:3001/api/auth/jwks',
    }),
    GraphQLModule.forRootAsync<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      useFactory: async () => {
        const repository = new PostgresUserRepository(
          new Pool({ connectionString: process.env.DATABASE_URL }),
        );
        const runtime = await createIdentitySchema(
          new IdentityResolver(repository),
        );
        return {
          schema: runtime.schema,
          path: '/graphql',
          context: ({
            req,
          }: {
            req: { headers: Record<string, string | undefined> };
          }) => {
            const cache = new Map<
              string,
              ReturnType<typeof repository.findById>
            >();
            return {
              req,
              loadUser(id: string) {
                const existing = cache.get(id);
                if (existing) return existing;
                const user = repository.findById(id);
                cache.set(id, user);
                return user;
              },
            };
          },
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard }],
})(IdentityModule);
