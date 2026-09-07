import { Inject, Injectable } from '@nestjs/common';

import { CompensateRegistrationUseCase } from '../application/use-cases/compensate-registration.use-case.ts';
import { CustomerIdentityPort } from '../application/ports/customer-identity.port.ts';
import { IdentityAccountPort } from '../application/ports/identity-account.port.ts';
import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';

@Injectable()
export class RegistrationCompensationService {
  private readonly useCase: CompensateRegistrationUseCase;

  constructor(
    @Inject(WordPressIdentityService)
    private readonly wordpress: Pick<
      WordPressIdentityService,
      'deleteCustomer'
    >,
  ) {
    this.useCase = new CompensateRegistrationUseCase({
      deleteCustomer: (customerId) => this.wordpress.deleteCustomer(customerId),
    } satisfies Pick<CustomerIdentityPort, 'deleteCustomer'>);
  }

  async compensate(
    identity: Pick<
      IdentityAccountPort,
      'deleteAccounts' | 'deleteUser' | 'deleteUserSessions'
    >,
    userId: string,
    wordpressUserId?: string,
  ) {
    return this.execute(identity, userId, wordpressUserId);
  }

  execute(
    identity: Pick<
      IdentityAccountPort,
      'deleteAccounts' | 'deleteUser' | 'deleteUserSessions'
    >,
    userId: string,
    wordpressUserId?: string,
  ) {
    return this.useCase.execute(identity, userId, wordpressUserId);
  }
}
