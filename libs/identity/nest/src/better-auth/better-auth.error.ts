export class BetterAuthError extends Error {
  constructor(
    readonly code: 'BETTER_AUTH_SECRET_REQUIRED',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BetterAuthError';
  }
}
