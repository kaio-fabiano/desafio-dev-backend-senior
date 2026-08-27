import { Module } from '@nestjs/common';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Pool } from 'pg';

import { IdentityResolver } from './identity.resolver.ts';
import { createIdentitySchema } from './identity-schema.ts';
import { PostgresUserRepository } from './postgres-user.repository.ts';

export class IdentityModule {}

Module({
  imports: [
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
              subject: req.headers['x-authenticated-subject'] ?? '',
              scopes: (req.headers['x-authenticated-scopes'] ?? '')
                .split(' ')
                .filter(Boolean),
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
})(IdentityModule);
