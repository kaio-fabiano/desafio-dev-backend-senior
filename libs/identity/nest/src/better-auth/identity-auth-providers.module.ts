import { Module } from '@nestjs/common';
import { BetterAuthFactory } from './better-auth.factory.ts';
import { IdentityAuthProvider } from './identity-auth-provider.provider.ts';
import { IdentityAuthToken } from './identity-auth-token.provider.ts';
import { IdentityDatabasePool } from './identity-database-pool.provider.ts';
@Module({ providers: [IdentityDatabasePool, BetterAuthFactory, IdentityAuthProvider.value], exports: [IdentityAuthToken.value] })
export class IdentityAuthProvidersModule {}
