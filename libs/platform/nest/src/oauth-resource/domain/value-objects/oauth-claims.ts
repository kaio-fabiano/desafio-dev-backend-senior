import { OAuthCredentialError } from '../errors/oauth-credential.error.ts';

export class OAuthClaims {
  private constructor(
    readonly audience: readonly string[],
    readonly claims: Readonly<Record<string, unknown>>,
    readonly scopes: readonly string[],
    readonly subject: string,
  ) {}

  static from(claims: Readonly<Record<string, unknown>>): OAuthClaims {
    if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
      throw new OAuthCredentialError(
        'Access token subject must be a non-empty string',
      );
    }
    if (claims.scope !== undefined && typeof claims.scope !== 'string') {
      throw new OAuthCredentialError('Access token scope must be a string');
    }
    const audience = Array.isArray(claims.aud)
      ? claims.aud.filter((value): value is string => typeof value === 'string')
      : typeof claims.aud === 'string'
        ? [claims.aud]
        : [];
    return new OAuthClaims(
      audience,
      claims,
      (claims.scope ?? '').split(' ').filter(Boolean),
      claims.sub,
    );
  }
}
