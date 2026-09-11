export class GatewayErrorMessages {
  static readonly accessTokenAlgorithmMustBeEs256 =
    'Access token algorithm must be ES256';
  static readonly accessTokenHeaderMustBeValidJson =
    'Access token header must be valid JSON';
  static readonly accessTokenKeyIdIsRequired =
    'Access token key ID is required';
  static readonly accessTokenMustBeCompactJwt =
    'Access token must be a compact JWT';
  static readonly originMustUseHttpOrHttps =
    'Gateway origin must use HTTP or HTTPS';
  static readonly requestTargetMustBeAbsolutePath =
    'Gateway request target must be an absolute path';
  static readonly unauthorized = 'Unauthorized';
  static readonly wordpressCredentialExchangeFailed =
    'WordPress credential exchange failed';

  static subgraphUrlIsRequired(name: string): string {
    return `Subgraph ${name} URL is required`;
  }
}
