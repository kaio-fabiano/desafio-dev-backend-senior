import { Inject, Injectable } from '@nestjs/common';

import { CompensateRegistrationUseCase } from '../application/use-cases/compensate-registration.use-case.ts';
import { IdentityAccountPort } from '../application/ports/identity-account.port.ts';

@Injectable()
export class RegistrationCompensationService {
  constructor(
    @Inject(CompensateRegistrationUseCase)
    private readonly useCase: CompensateRegistrationUseCase,
  ) {}

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
