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

import { BetterAuthModule } from './better-auth/better-auth.module.ts';
import { IdentityResolver } from './graphql/identity.resolver.ts';
import { UserLoader } from './graphql/user.loader.ts';
import { IdentityUserRepository } from './graphql/user.repository.ts';
import { OAuthIssuerModule } from './oauth-issuer/oauth-issuer.module.ts';

@Module({
  imports: [
    BetterAuthModule,
    OAuthIssuerModule,
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
      fieldResolverEnhancers: ['guards'],
    }),
  ],
  providers: [
    IdentityUserRepository,
    IdentityResolver,
    UserLoader,
    { provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard },
  ],
})
export class IdentityModule {}
