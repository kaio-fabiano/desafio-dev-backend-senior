export class OAuthCredentialVerification {
  constructor(
    readonly authorizationHeader: string | null | undefined,
    readonly dpopProofJwt: string | null | undefined,
    readonly method: string,
    readonly url: string,
  ) {}
}
