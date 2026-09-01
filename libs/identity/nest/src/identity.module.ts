import { Module } from '@nestjs/common';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

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

export function trustedFederationContext(
  headers: Record<string, string | string[] | undefined>,
  expectedSecret =
    process.env.FEDERATION_INTERNAL_SECRET ?? 'federation-local-only',
) {
  if (
    !expectedSecret ||
    header(headers, 'x-federation-secret') !== expectedSecret
  ) {
    throw new GraphQLError('Unauthorized', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  return {
    subject: header(headers, 'x-authenticated-subject'),
    scopes: header(headers, 'x-authenticated-scopes').split(' ').filter(Boolean),
  };
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
      }) => trustedFederationContext(req.headers),
    }),
  ],
  providers: [IdentityResolver, RegistrationService, wordpressIdentityProvider],
})(IdentityModule);
