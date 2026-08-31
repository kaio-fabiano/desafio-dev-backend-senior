import type { createIdentityAuth } from '../auth/config.ts';

type IdentityAuth = ReturnType<typeof createIdentityAuth>;

export class IdentityRegistrationRejected extends Error {
  constructor(readonly response: Response) {
    super(`Better Auth registration rejected: ${response.status}`);
  }
}

export function createBetterAuthIdentityAdapter(
  auth: IdentityAuth,
  request: Request,
) {
  let registrationResponse: Response | undefined;

  return {
    async createEmailIdentity() {
      registrationResponse = await auth.handler(request);
      if (!registrationResponse.ok)
        throw new IdentityRegistrationRejected(registrationResponse);
      const result = (await registrationResponse.clone().json()) as {
        user: { id: string };
      };
      return { id: result.user.id };
    },
    async linkAccount(
      userId: string,
      account: { providerId: string; accountId: string },
    ) {
      const { internalAdapter } = await auth.$context;
      await internalAdapter.linkAccount({
        ...account,
        issuer: account.providerId,
        userId,
      });
    },
    async deleteIdentity(userId: string) {
      const { internalAdapter } = await auth.$context;
      try {
        await internalAdapter.deleteUserSessions(userId);
        await internalAdapter.deleteAccounts(userId);
      } catch {
        return false;
      }
      await internalAdapter.deleteUser(userId).catch(() => undefined);
      return true;
    },
    async disableIdentity(userId: string) {
      const { internalAdapter } = await auth.$context;
      await internalAdapter.deleteUserSessions(userId);
      await internalAdapter.deleteAccounts(userId);
    },
    registrationResponse() {
      if (!registrationResponse)
        throw new Error('Better Auth registration did not produce a response');
      return registrationResponse;
    },
  };
}
