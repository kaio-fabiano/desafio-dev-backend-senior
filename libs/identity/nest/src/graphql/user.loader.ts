import { Inject, Injectable, Scope } from '@nestjs/common';

import { IdentityUserQueryPort } from '../application/ports/identity-user-query.port.ts';
import { FindIdentityUsersUseCase } from '../application/use-cases/find-identity-users.use-case.ts';

@Injectable({ scope: Scope.REQUEST })
export class UserLoader extends FindIdentityUsersUseCase {
  constructor(
    @Inject(IdentityUserQueryPort)
    users: IdentityUserQueryPort,
  ) {
    super(users);
  }
}
