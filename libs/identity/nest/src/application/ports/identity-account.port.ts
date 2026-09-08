export abstract class IdentityAccountPort {
  abstract deleteAccounts(subject: string): Promise<unknown>;
  abstract deleteUser(subject: string): Promise<unknown>;
  abstract deleteUserSessions(subject: string): Promise<unknown>;
  abstract linkExternalIdentity(
    externalIdentityId: string,
    subject: string,
  ): Promise<void>;
}
