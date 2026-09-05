import { describe, expect, it, vi } from 'vitest';

import { RegistrationCompensationService } from './registration-compensation.service.ts';
import type { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';

function identityAdapter() {
  return {
    deleteAccounts: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    deleteUserSessions: vi.fn().mockResolvedValue(undefined),
  };
}

function wordpressService() {
  return {
    deleteCustomer: vi.fn().mockResolvedValue(undefined),
  } satisfies Pick<WordPressIdentityService, 'deleteCustomer'>;
}

describe('RegistrationCompensationService', () => {
  it('cleans only resources owned by the failed attempt @spec:AC-235', async () => {
    const identity = identityAdapter();
    const wordpress = wordpressService();
    const compensation = new RegistrationCompensationService(wordpress);

    const failures = await compensation.compensate(
      identity,
      'better-auth-user',
      'wordpress-user',
    );

    expect(failures).toEqual([]);
    expect(wordpress.deleteCustomer).toHaveBeenCalledExactlyOnceWith(
      'wordpress-user',
    );
    expect(identity.deleteUserSessions).toHaveBeenCalledWith(
      'better-auth-user',
    );
    expect(identity.deleteAccounts).toHaveBeenCalledWith('better-auth-user');
    expect(identity.deleteUser).toHaveBeenCalledWith('better-auth-user');
  });

  it('does not delete a WordPress customer without an owned id @spec:AC-235', async () => {
    const identity = identityAdapter();
    const wordpress = wordpressService();
    const compensation = new RegistrationCompensationService(wordpress);

    await compensation.compensate(identity, 'better-auth-user');

    expect(wordpress.deleteCustomer).not.toHaveBeenCalled();
    expect(identity.deleteUser).toHaveBeenCalledWith('better-auth-user');
  });

  it('continues cleanup and reports every failure @spec:AC-233 @spec:AC-235', async () => {
    const identity = identityAdapter();
    identity.deleteUserSessions.mockRejectedValue(
      new Error('session cleanup failed'),
    );
    identity.deleteAccounts.mockRejectedValue(
      new Error('account cleanup failed'),
    );
    const wordpress = wordpressService();
    wordpress.deleteCustomer.mockRejectedValue(
      new Error('WordPress cleanup failed'),
    );
    const compensation = new RegistrationCompensationService(wordpress);

    const failures = await compensation.compensate(
      identity,
      'better-auth-user',
      'wordpress-user',
    );

    expect(identity.deleteUser).toHaveBeenCalledWith('better-auth-user');
    expect(failures).toEqual([
      expect.objectContaining({ step: 'wordpress' }),
      expect.objectContaining({ step: 'sessions' }),
      expect.objectContaining({ step: 'accounts' }),
    ]);
  });
});
