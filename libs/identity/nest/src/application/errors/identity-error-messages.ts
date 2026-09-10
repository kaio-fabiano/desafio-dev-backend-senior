export class IdentityErrorMessages {
  static readonly healthNotReady = 'Service Unavailable';
  static readonly invalidUserCursor = 'Invalid user cursor';
  static readonly invalidUserPageSize = 'first must be between 1 and 100';

  static readonly betterAuth = {
    BETTER_AUTH_SECRET_REQUIRED: 'BETTER_AUTH_SECRET is required in production',
  } as const;

  static readonly oauth = {
    OAUTH_CLIENT_SEED_FAILED: 'Identity client seed failed',
    OAUTH_CLIENTS_NOT_READY: 'Identity OAuth clients are not ready',
    SEED_ADMIN_PASSWORD_REQUIRED:
      'SEED_ADMIN_PASSWORD is required to create OAuth clients',
  } as const;

  static readonly registration = {
    IDENTITY_ACCOUNT_ADAPTER_REQUIRED: 'Identity account adapter is required',
    REGISTRATION_COMPENSATION_FAILED:
      'Registration failed and compensation was incomplete',
    REGISTRATION_COULD_NOT_BE_COMPLETED: 'Registration could not be completed',
  } as const;

  static readonly wordpress = {
    WORDPRESS_CONFIGURATION_INVALID:
      'WPGRAPHQL_SITE_TOKEN is required in production',
    WORDPRESS_CREATE_FAILED: 'WordPress identity creation failed',
    WORDPRESS_CREATE_RETURNED_NO_CUSTOMER:
      'WordPress identity creation returned no customer',
    WORDPRESS_DELETE_FAILED: 'WordPress identity rollback failed',
    WORDPRESS_IDENTITY_ALREADY_EXISTS: 'WordPress identity already exists',
    WORDPRESS_LINK_FAILED: 'WordPress identity link failed',
    WORDPRESS_REGISTRAR_AUTHENTICATION_FAILED:
      'WordPress registrar authentication failed',
  } as const;

  static oauthClientSeedFailed(status: number): string {
    return `${this.oauth.OAUTH_CLIENT_SEED_FAILED}: ${status}`;
  }
}
