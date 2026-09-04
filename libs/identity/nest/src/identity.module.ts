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

import { BetterAuthModule } from './auth/better-auth.module.ts';
import {
  RegistrationService,
  wordpressIdentityProvider,
} from './auth/registration.service.ts';
import { IdentityResolver } from './graphql/identity.resolver.ts';
import { UserLoader } from './graphql/user.loader.ts';

export class IdentityModule {}

Module({
  imports: [
    BetterAuthModule,
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
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      path: '/graphql',
      typePaths: ['libs/contracts/graphql/identity/schema.graphql'],
      context: ({
        req,
      }: {
        req: { headers: Record<string, string | string[] | undefined> };
      }) => ({ req }),
    }),
  ],
  providers: [
    IdentityResolver,
    UserLoader,
    RegistrationService,
    wordpressIdentityProvider,
    { provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard },
  ],
})(IdentityModule);
