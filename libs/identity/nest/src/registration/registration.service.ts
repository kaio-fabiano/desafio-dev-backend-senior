import { Inject, Injectable } from '@nestjs/common';
import {
  AfterHook,
  Hook,
  type AuthHookContext,
} from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';

import { RegisterIdentityCommand } from '../application/commands/register-identity.command.ts';
import { CustomerIdentityPort } from '../application/ports/customer-identity.port.ts';
import { CompensateRegistrationUseCase } from '../application/use-cases/compensate-registration.use-case.ts';
import { RegisterIdentityUseCase } from '../application/use-cases/register-identity.use-case.ts';
import { IdentityRegistrationPolicy } from '../domain/policies/identity-registration.policy.ts';
import { BetterAuthIdentityAccountAdapter } from '../infrastructure/better-auth/better-auth-identity-account.adapter.ts';
import { IdentityBootstrap } from './identity-bootstrap.ts';

@Hook()
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(CustomerIdentityPort)
    private readonly customer: CustomerIdentityPort,
    @Inject(CompensateRegistrationUseCase)
    private readonly compensation: Pick<
      CompensateRegistrationUseCase,
      'execute'
    >,
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

    const identity = new BetterAuthIdentityAccountAdapter(
      context.context.internalAdapter,
    );
    try {
      await new RegisterIdentityUseCase(
        this.customer,
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
