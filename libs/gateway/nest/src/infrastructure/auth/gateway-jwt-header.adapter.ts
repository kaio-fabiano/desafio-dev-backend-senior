import { OAuthCredentialError } from '@desafio-dev-backend-senior/source/platform-nest';
import { GatewayErrorMessages } from '../../application/gateway-error-messages.ts';

export class GatewayJwtHeaderAdapter {
  static assert(authorization: string | null): void {
    if (!authorization) return;
    const compact = /^\S+\s+(\S+)$/.exec(authorization)?.[1];
    const encodedHeader = compact?.split('.')[0];
    if (!compact || compact.split('.').length !== 3 || !encodedHeader) {
      throw new OAuthCredentialError(
        GatewayErrorMessages.accessTokenMustBeCompactJwt,
      );
    }
    let header: unknown;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString());
    } catch {
      throw new OAuthCredentialError(
        GatewayErrorMessages.accessTokenHeaderMustBeValidJson,
      );
    }
    if (
      typeof header !== 'object' ||
      header === null ||
      !('kid' in header) ||
      typeof header.kid !== 'string' ||
      header.kid.length === 0
    ) {
      throw new OAuthCredentialError(
        GatewayErrorMessages.accessTokenKeyIdIsRequired,
      );
    }
    if (!('alg' in header) || header.alg !== 'ES256') {
      throw new OAuthCredentialError(
        GatewayErrorMessages.accessTokenAlgorithmMustBeEs256,
      );
    }
  }
}
