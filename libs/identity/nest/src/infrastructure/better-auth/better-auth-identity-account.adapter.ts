import type { AuthHookContext } from '@thallesp/nestjs-better-auth';

import { IdentityAccountPort } from '../../application/ports/identity-account.port.ts';

export class BetterAuthIdentityAccountAdapter implements IdentityAccountPort {
  constructor(
    private readonly adapter: AuthHookContext['context']['internalAdapter'],
  ) {}

  deleteAccounts(subject: string): Promise<unknown> {
    return this.adapter.deleteAccounts(subject);
  }

  deleteUser(subject: string): Promise<unknown> {
    return this.adapter.deleteUser(subject);
  }

  deleteUserSessions(subject: string): Promise<unknown> {
    return this.adapter.deleteUserSessions(subject);
  }

  async linkExternalIdentity(
    externalIdentityId: string,
    subject: string,
  ): Promise<void> {
    await this.adapter.linkAccount({
      accountId: externalIdentityId,
      issuer: 'wordpress',
      providerId: 'wordpress',
      userId: subject,
    });
  }
}
