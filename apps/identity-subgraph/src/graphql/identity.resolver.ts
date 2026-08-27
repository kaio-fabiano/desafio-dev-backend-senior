import type { AuthContext } from '../../../gateway/src/auth/auth-context.ts';

export type IdentityUser = { id: string; email: string };

export class IdentityResolver {
  constructor(private readonly findUser: (id: string) => Promise<IdentityUser | null>) {}

  me(context: AuthContext) {
    return this.findUser(context.subject);
  }

  resolveReference(reference: { id: string }) {
    return this.findUser(reference.id);
  }
}
