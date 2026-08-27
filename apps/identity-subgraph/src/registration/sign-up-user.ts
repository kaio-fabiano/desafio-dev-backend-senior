import type { WordPressIdentityPort } from './wordpress-identity.port.ts';

type IdentityStore = {
  createEmailIdentity(input: { email: string; password: string; name: string }): Promise<{ id: string }>;
  linkAccount(userId: string, account: { providerId: string; accountId: string }): Promise<void>;
  deleteIdentity(userId: string): Promise<boolean>;
  markPendingWordPressLink(userId: string): Promise<void>;
};

export class RegistrationIncompleteError extends Error {}

export async function signUpUser(
  input: { email: string; password: string; name: string },
  identity: IdentityStore,
  wordpress: WordPressIdentityPort,
) {
  const user = await identity.createEmailIdentity(input);
  try {
    const account = await wordpress.createOrLink(input);
    await identity.linkAccount(user.id, {
      providerId: 'wordpress',
      accountId: account.id,
    });
    return { id: user.id, accounts: ['email', 'wordpress'] as const };
  } catch (cause) {
    if (!(await identity.deleteIdentity(user.id))) {
      await identity.markPendingWordPressLink(user.id);
    }
    throw new RegistrationIncompleteError('WordPress identity link failed', { cause });
  }
}
