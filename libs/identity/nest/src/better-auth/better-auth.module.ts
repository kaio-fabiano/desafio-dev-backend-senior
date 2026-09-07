import { Module } from '@nestjs/common';
import { AuthModule as NestJSBetterAuth } from '@thallesp/nestjs-better-auth';

export { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from './identity-auth.types.d.ts';
import { IdentityAuthProvidersModule } from './identity-auth-providers.module.ts';
import { IdentityAuthToken } from './identity-auth-token.provider.ts';
import { RegistrationModule } from '../registration/registration.module.ts';

@Module({
  imports: [
    IdentityAuthProvidersModule,
    RegistrationModule,
    NestJSBetterAuth.forRootAsync({
      imports: [IdentityAuthProvidersModule],
      inject: [IdentityAuthToken.value],
      disableGlobalAuthGuard: true,
      useFactory: (auth: IdentityAuth) => ({ auth }),
    }),
  ],
  exports: [NestJSBetterAuth],
})
export class BetterAuthModule {}
