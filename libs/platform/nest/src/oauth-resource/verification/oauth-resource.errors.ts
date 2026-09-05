import { isAPIError } from 'better-auth/api';

export const OAUTH_AUTHENTICATION_MESSAGES = {
  authenticatedSubjectRequired: 'Authenticated subject is required',
  bearerTokenRequired: 'Bearer token required',
  invalidBearerToken: 'Invalid bearer token',
  requiredScopeMissing: 'Required OAuth scope is missing',
} as const;

export class OAuthCredentialError extends Error {}

export function isOAuthCredentialError(error: unknown): boolean {
  return (
    error instanceof OAuthCredentialError ||
    (isAPIError(error) && error.statusCode === 401)
  );
}
