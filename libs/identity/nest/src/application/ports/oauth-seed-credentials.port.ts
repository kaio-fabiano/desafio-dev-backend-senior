import { OAuthSeedCredentials } from '../dto/oauth-seed-credentials.dto.ts';

export abstract class OAuthSeedCredentialsPort {
  abstract get(): OAuthSeedCredentials;
}
