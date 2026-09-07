import type { AuthHookContext } from '@thallesp/nestjs-better-auth';
export type SignUpResult = { user?: { id: string } };
export type SignUpInput = { email?: string; name?: string; password?: string };
export type RegistrationIdentityAdapter = Pick<AuthHookContext['context']['internalAdapter'], 'deleteAccounts' | 'deleteUser' | 'deleteUserSessions'>;
export type CompensationFailure = { cause: unknown; step: 'wordpress' | 'sessions' | 'accounts' | 'user'; };
