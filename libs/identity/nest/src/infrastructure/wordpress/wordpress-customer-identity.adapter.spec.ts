import { describe, expect, it, vi } from 'vitest';

import { RegisterIdentityCommand } from '../../application/commands/register-identity.command.ts';
import { WordPressIdentityService } from '../../wordpress/wordpress-identity.service.ts';
import { WordPressCustomerIdentityAdapter } from './wordpress-customer-identity.adapter.ts';

describe('WordPressCustomerIdentityAdapter', () => {
  it('implements the customer identity port through WordPress @spec:AC-263', async () => {
    const wordpress = {
      createCustomer: vi.fn().mockResolvedValue({ id: 'wordpress-user' }),
      deleteCustomer: vi.fn().mockResolvedValue(undefined),
      linkSubject: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new WordPressCustomerIdentityAdapter(
      wordpress as unknown as WordPressIdentityService,
    );
    const command = new RegisterIdentityCommand(
      'buyer@example.test',
      'Buyer',
      'secret-password',
      'better-auth-user',
    );

    await expect(adapter.createCustomer(command)).resolves.toBe(
      'wordpress-user',
    );
    await adapter.linkSubject('wordpress-user', 'better-auth-user');
    await adapter.deleteCustomer('wordpress-user');

    expect(wordpress.createCustomer).toHaveBeenCalledWith(command);
    expect(wordpress.linkSubject).toHaveBeenCalledWith(
      'wordpress-user',
      'better-auth-user',
    );
    expect(wordpress.deleteCustomer).toHaveBeenCalledWith('wordpress-user');
  });
});
