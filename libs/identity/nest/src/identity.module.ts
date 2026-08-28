import { Module } from '@nestjs/common';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';

import { BetterAuthModule } from './auth/better-auth.module.ts';
import {
  RegistrationService,
  wordpressIdentityProvider,
} from './auth/registration.service.ts';
import { IdentityResolver } from './graphql/identity.resolver.ts';

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : (value ?? '');
}

export class IdentityModule {}

Module({
  imports: [
    BetterAuthModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      path: '/graphql',
      typePaths: ['libs/contracts/graphql/identity/schema.graphql'],
      context: ({
        req,
      }: {
        req: { headers: Record<string, string | string[] | undefined> };
      }) => ({
        subject: header(req.headers, 'x-authenticated-subject'),
        scopes: header(req.headers, 'x-authenticated-scopes')
          .split(' ')
          .filter(Boolean),
      }),
    }),
  ],
  providers: [IdentityResolver, RegistrationService, wordpressIdentityProvider],
})(IdentityModule);
