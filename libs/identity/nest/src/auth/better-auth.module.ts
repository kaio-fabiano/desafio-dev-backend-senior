import { Controller, Get, Inject, Module, type Provider } from '@nestjs/common';
import { AuthModule as NestJSBetterAuth } from '@thallesp/nestjs-better-auth';

export { AuthService } from '@thallesp/nestjs-better-auth';

import {
  BetterAuthFactory,
  type IdentityAuth,
  IdentityAuthBootstrap,
} from './better-auth.factory.ts';
import { JwtPluginFactory } from './plugins/jwt-plugin.factory.ts';
import { OAuthProviderPluginFactory } from './plugins/oauth-provider-plugin.factory.ts';

export const IDENTITY_AUTH = Symbol('IDENTITY_AUTH');

const identityAuthProvider: Provider = {
  provide: IDENTITY_AUTH,
  inject: [BetterAuthFactory],
  useFactory: (factory: BetterAuthFactory) => factory.create(),
};

class IdentityAuthProvidersModule {}

Module({
  providers: [
    JwtPluginFactory,
    OAuthProviderPluginFactory,
    BetterAuthFactory,
    identityAuthProvider,
  ],
  exports: [IDENTITY_AUTH],
})(IdentityAuthProvidersModule);

class OAuthClientsController {
  constructor(private readonly bootstrap: IdentityAuthBootstrap) {}

  clients() {
    return this.bootstrap.clientIds;
  }
}

Controller('oauth/clients')(OAuthClientsController);
Get()(
  OAuthClientsController.prototype,
  'clients',
  Object.getOwnPropertyDescriptor(OAuthClientsController.prototype, 'clients')!,
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
