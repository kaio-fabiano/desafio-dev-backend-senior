export type OAuthErrorCode =
  | 'OAUTH_CLIENT_SEED_FAILED'
  | 'OAUTH_CLIENTS_NOT_READY'
  | 'SEED_ADMIN_PASSWORD_REQUIRED';

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
