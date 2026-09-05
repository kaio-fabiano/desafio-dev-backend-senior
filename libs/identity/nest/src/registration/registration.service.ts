import { Inject, Injectable } from '@nestjs/common';
import {
  AfterHook,
  Hook,
  type AuthHookContext,
} from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';
import { randomUUID } from 'node:crypto';

import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';
import { RegistrationCompensationService } from './registration-compensation.service.ts';
import { RegistrationError } from './registration.error.ts';

const WORDPRESS_PROVIDER_ID = 'wordpress';
const identityBootstrapToken = randomUUID();

export function identityBootstrapHeaders(): Headers {
  return new Headers({ 'x-identity-bootstrap': identityBootstrapToken });
}

type SignUpResult = { user?: { id: string } };
type SignUpInput = { email?: string; name?: string; password?: string };

@Hook()
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(WordPressIdentityService)
    private readonly wordpress: Pick<
      WordPressIdentityService,
      'createCustomer' | 'linkSubject'
    >,
    @Inject(RegistrationCompensationService)
    private readonly compensation: RegistrationCompensationService,
  ) {}

  @AfterHook('/sign-up/email') // DatabaseHook seria melhor?
  async afterEmailSignUp(context: AuthHookContext): Promise<void> {
    if (
      context.headers?.get('x-identity-bootstrap') === identityBootstrapToken
    ) {
      return;
    }
    const input = context.body as SignUpInput | undefined;
    const result = await this.signUpResult(context.context.returned);
    if (!input?.email || !input.name || !input.password || !result.user) return;

    const betterAuthInternalAdapter = context.context.internalAdapter;
    let wordpressUserId: string | undefined;
    try {
      const account = await this.wordpress.createCustomer({
        email: input.email,
        name: input.name,
        password: input.password,
      });
      wordpressUserId = account.id;
      await betterAuthInternalAdapter.linkAccount({
        accountId: account.id,
        issuer: WORDPRESS_PROVIDER_ID,
        providerId: WORDPRESS_PROVIDER_ID,
        userId: result.user.id,
      });
      await this.wordpress.linkSubject(account.id, result.user.id);
    } catch (cause) {
      const failures = await this.compensation.compensate(
        betterAuthInternalAdapter,
        result.user.id,
        wordpressUserId,
      );
      const apiCause = failures.length
        ? new RegistrationError(
            'REGISTRATION_COMPENSATION_FAILED',
            'Registration failed and compensation was incomplete',
            { cause, failures },
          )
        : cause;
      throw new APIError('SERVICE_UNAVAILABLE', {
        cause: apiCause,
        code: 'WORDPRESS_IDENTITY_LINK_FAILED',
        message: 'Registration could not be completed',
      });
    }
  }

  private async signUpResult(returned: unknown): Promise<SignUpResult> {
    if (returned instanceof Response) {
      return returned.ok
        ? ((await returned.clone().json()) as SignUpResult)
        : {};
    }
    return (returned ?? {}) as SignUpResult;
  }
}
