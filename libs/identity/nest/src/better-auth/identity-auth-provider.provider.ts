import type { Provider } from '@nestjs/common';
import { BetterAuthFactory } from './better-auth.factory.ts';
import { IdentityAuthToken } from './identity-auth-token.provider.ts';
export class IdentityAuthProvider { static readonly value: Provider = { provide: IdentityAuthToken.value, inject: [BetterAuthFactory], useFactory: (factory: BetterAuthFactory) => factory.create() }; }
