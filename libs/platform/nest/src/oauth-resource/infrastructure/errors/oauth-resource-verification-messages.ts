export class OAuthResourceVerificationMessages {
  static readonly invalidRequestProtocol =
    'OAuth request protocol must be HTTP or HTTPS';
  static readonly invalidRequestTarget =
    'OAuth request target must be an absolute path';

  static invalidUrl(label: string): string {
    return `${label} must be a valid URL`;
  }
}
