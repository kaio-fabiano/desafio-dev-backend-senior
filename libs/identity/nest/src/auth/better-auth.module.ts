import { Controller, Get, Inject, Module, type Provider } from '@nestjs/common';
import { AuthModule as NestJSBetterAuth } from '@thallesp/nestjs-better-auth';

export { AuthService } from '@thallesp/nestjs-better-auth';

import {
  BetterAuthFactory,
  type IdentityAuth,
  IdentityAuthBootstrap,
} from './better-auth.factory.ts';

export const IDENTITY_AUTH = Symbol('IDENTITY_AUTH');

const identityAuthProvider: Provider = {
  provide: IDENTITY_AUTH,
  inject: [BetterAuthFactory],
  useFactory: (factory: BetterAuthFactory) => factory.create(),
};

class IdentityAuthProvidersModule {}

Module({
  providers: [BetterAuthFactory, identityAuthProvider],
  exports: [IDENTITY_AUTH],
})(IdentityAuthProvidersModule);

class OAuthClientsController {
  constructor(private readonly bootstrap: IdentityAuthBootstrap) {}

  clients() {
    return this.bootstrap.clientIds;
  }
}

const clientsDescriptor = Object.getOwnPropertyDescriptor(
  OAuthClientsController.prototype,
  'clients',
);
if (!clientsDescriptor) throw new Error('OAuth clients handler is missing');

Controller('oauth/clients')(OAuthClientsController);
Get()(
  OAuthClientsController.prototype,
  'clients',
  clientsDescriptor,
);
Inject(IdentityAuthBootstrap)(OAuthClientsController, undefined, 0);

export class BetterAuthModule {}

Module({
  imports: [
    IdentityAuthProvidersModule,
    NestJSBetterAuth.forRootAsync({
      imports: [IdentityAuthProvidersModule],
      inject: [IDENTITY_AUTH],
      disableGlobalAuthGuard: true,
      useFactory: (auth: IdentityAuth) => ({ auth }),
    }),
  ],
  controllers: [OAuthClientsController],
  providers: [IdentityAuthBootstrap],
  exports: [NestJSBetterAuth, IdentityAuthBootstrap],
})(BetterAuthModule);
