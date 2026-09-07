import { Inject, Injectable } from '@nestjs/common';
import {
  AfterHook,
  Hook,
  type AuthHookContext,
} from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';

import { RegisterIdentityCommand } from '../application/commands/register-identity.command.ts';
import { CustomerIdentityPort } from '../application/ports/customer-identity.port.ts';
import { IdentityAccountPort } from '../application/ports/identity-account.port.ts';
import { RegisterIdentityUseCase } from '../application/use-cases/register-identity.use-case.ts';
import { IdentityRegistrationPolicy } from '../domain/policies/identity-registration.policy.ts';
import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';
import { IdentityBootstrap } from './identity-bootstrap.ts';
import { RegistrationCompensationService } from './registration-compensation.service.ts';

@Hook()
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(WordPressIdentityService)
    private readonly wordpress: Pick<
      WordPressIdentityService,
      'createCustomer' | 'deleteCustomer' | 'linkSubject'
    >,
    @Inject(RegistrationCompensationService)
    private readonly compensation: RegistrationCompensationService,
  ) {}

  @AfterHook('/sign-up/email') // DatabaseHook seria melhor?
  async afterEmailSignUp(context: AuthHookContext): Promise<void> {
    const input = context.body as
      | { email?: string; name?: string; password?: string }
      | undefined;
    const result = await this.signUpResult(context.context.returned);
    const registration = IdentityRegistrationPolicy.evaluate(
      IdentityBootstrap.matches(context.headers),
      input?.email,
      input?.name,
      input?.password,
      result.user?.id,
    );
    if (!registration) return;

    const betterAuthInternalAdapter = context.context.internalAdapter;
    const customer = {
      createCustomer: async (command: RegisterIdentityCommand) =>
        (await this.wordpress.createCustomer(command)).id,
      deleteCustomer: (customerId: string) =>
        this.wordpress.deleteCustomer(customerId),
      linkSubject: (customerId: string, subject: string) =>
        this.wordpress.linkSubject(customerId, subject),
    } satisfies CustomerIdentityPort;
    const identity = {
      deleteAccounts: (subject: string) =>
        betterAuthInternalAdapter.deleteAccounts(subject),
      deleteUser: (subject: string) =>
        betterAuthInternalAdapter.deleteUser(subject),
      deleteUserSessions: (subject: string) =>
        betterAuthInternalAdapter.deleteUserSessions(subject),
      linkExternalIdentity: async (
        externalIdentityId: string,
        subject: string,
      ) => {
        await betterAuthInternalAdapter.linkAccount({
          accountId: externalIdentityId,
          issuer: 'wordpress',
          providerId: 'wordpress',
          userId: subject,
        });
      },
    } satisfies IdentityAccountPort;
    try {
      await new RegisterIdentityUseCase(
        customer,
        identity,
        this.compensation,
      ).execute(
        new RegisterIdentityCommand(
          registration.email,
          registration.name,
          registration.password,
          registration.subject,
        ),
      );
    } catch (cause) {
      throw new APIError('SERVICE_UNAVAILABLE', {
        cause,
        code: 'WORDPRESS_IDENTITY_LINK_FAILED',
        message: 'Registration could not be completed',
      });
    }
  }

  private async signUpResult(
    returned: unknown,
  ): Promise<{ user?: { id: string } }> {
    if (returned instanceof Response) {
      return returned.ok
        ? ((await returned.clone().json()) as { user?: { id: string } })
        : {};
    }
    return (returned ?? {}) as { user?: { id: string } };
  }
}
