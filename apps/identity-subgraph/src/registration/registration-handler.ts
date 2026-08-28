import type { createIdentityAuth } from '../auth/config.ts';
import {
  createBetterAuthIdentityAdapter,
  IdentityRegistrationRejected,
} from './better-auth-identity.adapter.ts';
import { RegistrationIncompleteError, signUpUser } from './sign-up-user.ts';
import type { WordPressIdentityPort } from './wordpress-identity.port.ts';

type IdentityAuth = ReturnType<typeof createIdentityAuth>;

export function createRegistrationHandler(
  auth: IdentityAuth,
  wordpress: WordPressIdentityPort,
) {
  return async (request: Request) => {
    let input: { email: string; password: string; name: string };
    try {
      input = (await request.clone().json()) as typeof input;
    } catch {
      return auth.handler(request);
    }

    const identity = createBetterAuthIdentityAdapter(auth, request);
    try {
      await signUpUser(input, identity, wordpress);
      return identity.registrationResponse();
    } catch (error) {
      if (error instanceof IdentityRegistrationRejected) return error.response;
      if (error instanceof RegistrationIncompleteError) {
        return Response.json(
          {
            code: 'WORDPRESS_IDENTITY_LINK_FAILED',
            message: 'Registration could not be completed',
          },
          { status: 503 },
        );
      }
      throw error;
    }
  };
}
