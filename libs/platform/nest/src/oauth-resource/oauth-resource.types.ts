export type OAuthResourceOptions = {
  audience: string;
  issuer: string;
  jwksUrl: string;
};

export type OAuthClaims = {
  audience: readonly string[];
  claims: Readonly<Record<string, unknown>>;
  scopes: readonly string[];
  subject: string;
};

export type OAuthHttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  protocol?: string;
  url?: string;
};

export type OAuthGraphQLContext = {
  auth?: OAuthClaims;
  req?: OAuthHttpRequest;
};
