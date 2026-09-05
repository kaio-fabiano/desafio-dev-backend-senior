import type { AuthHookContext } from '@thallesp/nestjs-better-auth';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import type { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';
import { RegistrationCompensationService } from './registration-compensation.service.ts';
import { RegistrationError } from './registration.error.ts';
import {
  identityBootstrapHeaders,
  RegistrationService,
} from './registration.service.ts';

type IdentityAdapter = {
  deleteAccounts: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
  deleteUserSessions: ReturnType<typeof vi.fn>;
  linkAccount: ReturnType<typeof vi.fn>;
};

type RegistrationWordPressService = Pick<
  WordPressIdentityService,
  'createCustomer' | 'deleteCustomer' | 'linkSubject'
>;

function identityAdapter(): IdentityAdapter {
  return {
    deleteAccounts: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    deleteUserSessions: vi.fn().mockResolvedValue(undefined),
    linkAccount: vi.fn().mockResolvedValue(undefined),
  };
}

function signUpContext(
  adapter: IdentityAdapter,
  overrides: Record<string, unknown> = {},
): AuthHookContext {
  return {
    body: {
      email: 'buyer@example.test',
      name: 'Buyer',
      password: 'secret-password',
    },
    context: {
      internalAdapter: adapter,
      returned: { user: { id: 'better-auth-user' } },
    },
    ...overrides,
  } as unknown as AuthHookContext;
}

function wordpressService(
  overrides: Partial<RegistrationWordPressService> = {},
): RegistrationWordPressService {
  return {
    createCustomer: vi.fn().mockResolvedValue({ id: 'wordpress-user' }),
    deleteCustomer: vi.fn().mockResolvedValue(undefined),
    linkSubject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function registrationService(
  wordpress: RegistrationWordPressService,
): RegistrationService {
  return new RegistrationService(
    wordpress,
    new RegistrationCompensationService(wordpress),
  );
}

describe('RegistrationService', () => {
  it('links the WordPress account and subject after email signup @spec:AC-227 @spec:AC-234', async () => {
    const adapter = identityAdapter();
    const wordpress = wordpressService();
    const registration = registrationService(wordpress);

    await registration.afterEmailSignUp(signUpContext(adapter));

    expect(adapter.linkAccount).toHaveBeenCalledWith({
      accountId: 'wordpress-user',
      issuer: 'wordpress',
      providerId: 'wordpress',
      userId: 'better-auth-user',
    });
    expect(wordpress.linkSubject).toHaveBeenCalledWith(
      'wordpress-user',
      'better-auth-user',
    );
    expect(wordpress.deleteCustomer).not.toHaveBeenCalled();
  });

  it('keeps the private bootstrap signup out of WordPress', async () => {
    const adapter = identityAdapter();
    const wordpress = wordpressService();
    const registration = registrationService(wordpress);

    await registration.afterEmailSignUp(
      signUpContext(adapter, { headers: identityBootstrapHeaders() }),
    );

    expect(wordpress.createCustomer).not.toHaveBeenCalled();
    expect(adapter.linkAccount).not.toHaveBeenCalled();
  });

  it('compensates only the customer created by the failed attempt @spec:AC-235', async () => {
    const adapter = identityAdapter();
    adapter.linkAccount.mockRejectedValue(new Error('account link failed'));
    const wordpress = wordpressService();
    const registration = registrationService(wordpress);

    await expect(
      registration.afterEmailSignUp(signUpContext(adapter)),
    ).rejects.toMatchObject({
      body: { code: 'WORDPRESS_IDENTITY_LINK_FAILED' },
      statusCode: 503,
    });

    expect(wordpress.deleteCustomer).toHaveBeenCalledExactlyOnceWith(
      'wordpress-user',
    );
    expect(adapter.deleteUserSessions).toHaveBeenCalledWith('better-auth-user');
    expect(adapter.deleteAccounts).toHaveBeenCalledWith('better-auth-user');
    expect(adapter.deleteUser).toHaveBeenCalledWith('better-auth-user');
  });

  it('continues independent compensation and reports cleanup failures @spec:AC-235', async () => {
    const adapter = identityAdapter();
    adapter.linkAccount.mockRejectedValue(new Error('account link failed'));
    adapter.deleteUserSessions.mockRejectedValue(
      new Error('session cleanup failed'),
    );
    adapter.deleteAccounts.mockRejectedValue(
      new Error('account cleanup failed'),
    );
    const wordpress = wordpressService({
      deleteCustomer: vi
        .fn()
        .mockRejectedValue(new Error('WordPress cleanup failed')),
    });
    const registration = registrationService(wordpress);

    const failure = await registration
      .afterEmailSignUp(signUpContext(adapter))
      .catch((error: unknown) => error);

    expect(adapter.deleteUser).toHaveBeenCalledWith('better-auth-user');
    expect(failure).toMatchObject({
      body: { code: 'WORDPRESS_IDENTITY_LINK_FAILED' },
      cause: expect.objectContaining({
        code: 'REGISTRATION_COMPENSATION_FAILED',
        failures: expect.arrayContaining([
          expect.objectContaining({ step: 'wordpress' }),
          expect.objectContaining({ step: 'sessions' }),
          expect.objectContaining({ step: 'accounts' }),
        ]),
      }),
    });
    expect(failure).toMatchObject({
      cause: { cause: new Error('account link failed') },
    });
  });

  it('does not delete a pre-existing or raced WordPress account @spec:AC-235', async () => {
    const adapter = identityAdapter();
    const deleteCustomer = vi.fn().mockResolvedValue(undefined);
    const wordpress = wordpressService({
      createCustomer: vi.fn().mockRejectedValue(
        Object.assign(new Error('WordPress identity already exists'), {
          code: 'WORDPRESS_IDENTITY_ALREADY_EXISTS',
        }),
      ),
      deleteCustomer,
    });
    const registration = registrationService(wordpress);

    await expect(
      registration.afterEmailSignUp(signUpContext(adapter)),
    ).rejects.toMatchObject({
      body: { code: 'WORDPRESS_IDENTITY_LINK_FAILED' },
    });

    expect(deleteCustomer).not.toHaveBeenCalled();
    expect(adapter.deleteUser).toHaveBeenCalledWith('better-auth-user');
  });

  it('ignores incomplete and unsuccessful Better Auth hook results', async () => {
    const adapter = identityAdapter();
    const wordpress = wordpressService();
    const registration = registrationService(wordpress);

    await registration.afterEmailSignUp(
      signUpContext(adapter, {
        body: { email: 'missing-fields@example.test' },
      }),
    );
    await registration.afterEmailSignUp(
      signUpContext(adapter, {
        context: {
          internalAdapter: adapter,
          returned: new Response(null, { status: 400 }),
        },
      }),
    );

    expect(wordpress.createCustomer).not.toHaveBeenCalled();
  });

  it('reads a successful Better Auth response before linking identities', async () => {
    const adapter = identityAdapter();
    const wordpress = wordpressService();
    const registration = registrationService(wordpress);

    await registration.afterEmailSignUp(
      signUpContext(adapter, {
        context: {
          internalAdapter: adapter,
          returned: Response.json({ user: { id: 'response-user' } }),
        },
      }),
    );

    expect(adapter.linkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'response-user' }),
    );
  });

  it('keeps registration focused on Better Auth hook orchestration @spec:AC-233', () => {
    const source = readFileSync(
      new URL('./registration.service.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(
      /process\.env|\bfetch\(|wordpressIdentityProvider/,
    );
    expect(source).not.toContain('private async compensate');
  });
});

it('retains typed errors as standard Error causes', () => {
  const cause = new Error('upstream');
  const error = new RegistrationError(
    'REGISTRATION_COMPENSATION_FAILED',
    'failed',
    {
      cause,
    },
  );

  expect(error).toBeInstanceOf(Error);
  expect(error.cause).toBe(cause);
});
