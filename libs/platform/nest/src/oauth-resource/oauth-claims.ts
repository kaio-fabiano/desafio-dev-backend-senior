export declare class OAuthClaims {
  readonly audience: readonly string[];
  readonly claims: Readonly<Record<string, unknown>>;
  readonly scopes: readonly string[];
  readonly subject: string;
}
