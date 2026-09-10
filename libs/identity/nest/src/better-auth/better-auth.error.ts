import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';

export class BetterAuthError extends Error {
  constructor(
    readonly code: 'BETTER_AUTH_SECRET_REQUIRED',
    message: string = IdentityErrorMessages.betterAuth[code],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BetterAuthError';
  }
}
