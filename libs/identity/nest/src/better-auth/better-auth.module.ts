import { Module, type Provider } from '@nestjs/common';
import { AuthModule as NestJSBetterAuth } from '@thallesp/nestjs-better-auth';

export { AuthService } from '@thallesp/nestjs-better-auth';

import {
  BetterAuthFactory,
  type IdentityAuth,
  IdentityDatabasePool,
} from './better-auth.factory.ts';
import { RegistrationModule } from '../registration/registration.module.ts';

const IDENTITY_AUTH = Symbol('IDENTITY_AUTH');

const identityAuthProvider: Provider = {
  provide: IDENTITY_AUTH,
  inject: [BetterAuthFactory],
  useFactory: (factory: BetterAuthFactory) => factory.create(),
};

@Module({
  providers: [IdentityDatabasePool, BetterAuthFactory, identityAuthProvider],
  exports: [IDENTITY_AUTH],
})
class IdentityAuthProvidersModule {}

@Module({
  imports: [
    IdentityAuthProvidersModule,
    RegistrationModule,
    NestJSBetterAuth.forRootAsync({
      imports: [IdentityAuthProvidersModule],
      inject: [IDENTITY_AUTH],
      disableGlobalAuthGuard: true,
      useFactory: (auth: IdentityAuth) => ({ auth }),
    }),
  ],
  exports: [NestJSBetterAuth],
})
export class BetterAuthModule {}
