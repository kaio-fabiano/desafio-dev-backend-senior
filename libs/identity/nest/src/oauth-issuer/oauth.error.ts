import type { OAuthErrorCode } from './oauth-error-code.d.ts';

export class OAuthError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'OAuthError';
  }
}
