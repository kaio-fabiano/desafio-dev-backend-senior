import { Inject, Injectable } from '@nestjs/common';

import { RegisterIdentityCommand } from '../commands/register-identity.command.ts';
import { RegistrationError } from '../errors/registration.error.ts';
import { CustomerIdentityPort } from '../ports/customer-identity.port.ts';
import { IdentityAccountPort } from '../ports/identity-account.port.ts';
import { CompensateRegistrationUseCase } from './compensate-registration.use-case.ts';

@Injectable()
export class RegisterIdentityUseCase {
  private readonly compensation: Pick<CompensateRegistrationUseCase, 'execute'>;
  private readonly legacyIdentity?: IdentityAccountPort;

  constructor(
    customer: CustomerIdentityPort,
    compensation: Pick<CompensateRegistrationUseCase, 'execute'>,
  );
  constructor(
    customer: CustomerIdentityPort,
    identity: IdentityAccountPort,
    compensation: Pick<CompensateRegistrationUseCase, 'execute'>,
  );
  constructor(
    @Inject(CustomerIdentityPort)
    private readonly customer: CustomerIdentityPort,
    @Inject(CompensateRegistrationUseCase)
    identityOrCompensation:
      | IdentityAccountPort
      | Pick<CompensateRegistrationUseCase, 'execute'>,
    @Inject(CompensateRegistrationUseCase)
    legacyCompensation?: Pick<CompensateRegistrationUseCase, 'execute'>,
  ) {
    const containerManaged = 'execute' in identityOrCompensation;
    this.compensation = containerManaged
      ? identityOrCompensation
      : (legacyCompensation as Pick<CompensateRegistrationUseCase, 'execute'>);
    this.legacyIdentity = containerManaged ? undefined : identityOrCompensation;
  }

  async execute(
    command: RegisterIdentityCommand,
    identity = this.legacyIdentity,
  ): Promise<void> {
    if (!identity) throw new Error('Identity account adapter is required');
    let customerId: string | undefined;
    try {
      customerId = await this.customer.createCustomer(command);
      await identity.linkExternalIdentity(customerId, command.subject);
      await this.customer.linkSubject(customerId, command.subject);
    } catch (cause) {
      const failures = await this.compensation.execute(
        identity,
        command.subject,
        customerId,
      );
      if (!failures.length) throw cause;
      throw new RegistrationError(
        'REGISTRATION_COMPENSATION_FAILED',
        'Registration failed and compensation was incomplete',
        { cause, failures },
      );
    }
  }
}
