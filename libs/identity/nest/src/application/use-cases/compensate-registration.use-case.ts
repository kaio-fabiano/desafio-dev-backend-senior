import { Inject, Injectable } from '@nestjs/common';

import { RegistrationCompensationFailure } from '../dto/registration-compensation-failure.dto.ts';
import { CustomerIdentityPort } from '../ports/customer-identity.port.ts';
import { IdentityAccountPort } from '../ports/identity-account.port.ts';

@Injectable()
export class CompensateRegistrationUseCase {
  constructor(
    @Inject(CustomerIdentityPort)
    private readonly customer: Pick<CustomerIdentityPort, 'deleteCustomer'>,
  ) {}

  async execute(
    identity: Pick<
      IdentityAccountPort,
      'deleteAccounts' | 'deleteUser' | 'deleteUserSessions'
    >,
    subject: string,
    customerId?: string,
  ): Promise<RegistrationCompensationFailure[]> {
    const steps: Array<{
      run: () => Promise<unknown>;
      step: RegistrationCompensationFailure['step'];
    }> = [
      ...(customerId
        ? [
            {
              run: () => this.customer.deleteCustomer(customerId),
              step: 'wordpress' as const,
            },
          ]
        : []),
      { run: () => identity.deleteUserSessions(subject), step: 'sessions' },
      { run: () => identity.deleteAccounts(subject), step: 'accounts' },
      { run: () => identity.deleteUser(subject), step: 'user' },
    ];
    const failures: RegistrationCompensationFailure[] = [];
    for (const { run, step } of steps) {
      try {
        await run();
      } catch (cause) {
        failures.push(new RegistrationCompensationFailure(step, cause));
      }
    }
    return failures;
  }
}
