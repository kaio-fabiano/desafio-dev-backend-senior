import { RegisterIdentityCommand } from '../commands/register-identity.command.ts';
import { RegistrationError } from '../errors/registration.error.ts';
import { CustomerIdentityPort } from '../ports/customer-identity.port.ts';
import { IdentityAccountPort } from '../ports/identity-account.port.ts';
import { CompensateRegistrationUseCase } from './compensate-registration.use-case.ts';

export class RegisterIdentityUseCase {
  constructor(
    private readonly customer: CustomerIdentityPort,
    private readonly identity: IdentityAccountPort,
    private readonly compensation: Pick<
      CompensateRegistrationUseCase,
      'execute'
    >,
  ) {}

  async execute(command: RegisterIdentityCommand): Promise<void> {
    let customerId: string | undefined;
    try {
      customerId = await this.customer.createCustomer(command);
      await this.identity.linkExternalIdentity(customerId, command.subject);
      await this.customer.linkSubject(customerId, command.subject);
    } catch (cause) {
      const failures = await this.compensation.execute(
        this.identity,
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
