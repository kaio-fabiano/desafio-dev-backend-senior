import { IdentityUserConnection } from '../dto/identity-user-connection.dto.ts';
import { IdentityUserQueryPort } from '../ports/identity-user-query.port.ts';

export class ListIdentityUsersUseCase {
  constructor(private readonly users: IdentityUserQueryPort) {}

  execute(first: number, afterId?: string): Promise<IdentityUserConnection> {
    return this.users.findPage(first, afterId);
  }
}
