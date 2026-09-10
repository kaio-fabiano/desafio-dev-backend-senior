import { OAuthSeedCredentials } from '../../application/dto/oauth-seed-credentials.dto.ts';
import { IdentityErrorMessages } from '../../application/errors/identity-error-messages.ts';
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
        IdentityErrorMessages.oauth.SEED_ADMIN_PASSWORD_REQUIRED,
      );
    }
    return new OAuthSeedCredentials(
      process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
      password,
    );
  }
}
