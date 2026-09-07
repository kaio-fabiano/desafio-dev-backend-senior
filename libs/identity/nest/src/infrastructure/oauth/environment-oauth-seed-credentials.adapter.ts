import { OAuthSeedCredentials } from '../../application/dto/oauth-seed-credentials.dto.ts';
import { OAuthError } from '../../application/errors/oauth.error.ts';
import { OAuthSeedCredentialsPort } from '../../application/ports/oauth-seed-credentials.port.ts';

export class EnvironmentOAuthSeedCredentialsAdapter
  implements OAuthSeedCredentialsPort
{
  get(): OAuthSeedCredentials {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      throw new OAuthError(
        'SEED_ADMIN_PASSWORD_REQUIRED',
        'SEED_ADMIN_PASSWORD is required to create OAuth clients',
      );
    }
    return new OAuthSeedCredentials(
      process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
      password,
    );
  }
}
