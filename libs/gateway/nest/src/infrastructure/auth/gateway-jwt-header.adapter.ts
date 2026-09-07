import { OAuthCredentialError } from '@desafio-dev-backend-senior/source/platform-nest';

export class GatewayJwtHeaderAdapter {
  static assert(authorization: string | null): void {
    if (!authorization) return;
    const compact = /^\S+\s+(\S+)$/.exec(authorization)?.[1];
    const encodedHeader = compact?.split('.')[0];
    if (!compact || compact.split('.').length !== 3 || !encodedHeader) {
      throw new OAuthCredentialError('Access token must be a compact JWT');
    }
    let header: unknown;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString());
    } catch {
      throw new OAuthCredentialError('Access token header must be valid JSON');
    }
    if (
      typeof header !== 'object' ||
      header === null ||
      !('kid' in header) ||
      typeof header.kid !== 'string' ||
      header.kid.length === 0
    ) {
      throw new OAuthCredentialError('Access token key ID is required');
    }
    if (!('alg' in header) || header.alg !== 'ES256') {
      throw new OAuthCredentialError('Access token algorithm must be ES256');
    }
  }
}
