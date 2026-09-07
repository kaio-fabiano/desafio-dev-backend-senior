import { IdentityUserConnection } from '../dto/identity-user-connection.dto.ts';
import { IdentityUser } from '../dto/identity-user.dto.ts';

export abstract class IdentityUserQueryPort {
  abstract findByIds(ids: readonly string[]): Promise<IdentityUser[]>;
  abstract findPage(
    first: number,
    afterId?: string,
  ): Promise<IdentityUserConnection>;
}
