import type { IdentityUser } from './identity-user.types.d.ts';
export type PendingLoad = { id: string; resolve: (user: IdentityUser | null) => void; reject: (reason: unknown) => void; };
