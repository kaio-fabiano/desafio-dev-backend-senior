import { describe, expect, it, vi } from 'vitest';

import { RegisterIdentityCommand } from './application/commands/register-identity.command.ts';
import { OAuthSeedCredentials } from './application/dto/oauth-seed-credentials.dto.ts';
import { OAuthError } from './application/errors/oauth.error.ts';
import { CustomerIdentityPort } from './application/ports/customer-identity.port.ts';
import { IdentityAccountPort } from './application/ports/identity-account.port.ts';
import { OAuthClientProvisioningPort } from './application/ports/oauth-client-provisioning.port.ts';
import { OAuthSeedCredentialsPort } from './application/ports/oauth-seed-credentials.port.ts';
import { OAuthClientProvisioningPolicy } from './application/policies/oauth-client-provisioning.policy.ts';
import { CompensateRegistrationUseCase } from './application/use-cases/compensate-registration.use-case.ts';
import { ProvisionOAuthClientsUseCase } from './application/use-cases/provision-oauth-clients.use-case.ts';
import { RegisterIdentityUseCase } from './application/use-cases/register-identity.use-case.ts';
import { IdentityRegistrationPolicy } from './domain/policies/identity-registration.policy.ts';
import { OAuthResources } from './oauth-issuer/oauth-resources.ts';

function customerPort() {
  return {
    createCustomer: vi.fn<CustomerIdentityPort['createCustomer']>(),
    deleteCustomer: vi.fn<CustomerIdentityPort['deleteCustomer']>(),
    linkSubject: vi.fn<CustomerIdentityPort['linkSubject']>(),
  } satisfies CustomerIdentityPort;
}

function identityPort() {
  return {
    deleteAccounts: vi.fn<IdentityAccountPort['deleteAccounts']>(),
    deleteUser: vi.fn<IdentityAccountPort['deleteUser']>(),
    deleteUserSessions: vi.fn<IdentityAccountPort['deleteUserSessions']>(),
    linkExternalIdentity: vi.fn<IdentityAccountPort['linkExternalIdentity']>(),
  } satisfies IdentityAccountPort;
}

function provisioningPort() {
  return {
    createClient: vi.fn<OAuthClientProvisioningPort['createClient']>(),
    ensureResourceLinks:
      vi.fn<OAuthClientProvisioningPort['ensureResourceLinks']>(),
    findClient: vi.fn<OAuthClientProvisioningPort['findClient']>(),
    openAdministratorSession:
      vi.fn<OAuthClientProvisioningPort['openAdministratorSession']>(),
    prepareResources: vi.fn<OAuthClientProvisioningPort['prepareResources']>(),
  } satisfies OAuthClientProvisioningPort;
}

describe('Identity registration core', () => {
  it('applies the characterized registration eligibility policy', () => {
    expect(
      IdentityRegistrationPolicy.evaluate(
        false,
        'buyer@example.test',
        'Buyer',
        'secret',
        'identity-user',
      ),
    ).toEqual({
      email: 'buyer@example.test',
      name: 'Buyer',
      password: 'secret',
      subject: 'identity-user',
    });
    expect(
      IdentityRegistrationPolicy.evaluate(
        true,
        'admin@example.test',
        'Admin',
        'secret',
        'identity-admin',
      ),
    ).toBeUndefined();
    for (const [bootstrap, email, name, password, subject] of [
      [false, undefined, 'Buyer', 'secret', 'identity-user'],
      [false, 'buyer@example.test', undefined, 'secret', 'identity-user'],
      [false, 'buyer@example.test', 'Buyer', undefined, 'identity-user'],
      [false, 'buyer@example.test', 'Buyer', 'secret', undefined],
    ] as const) {
      expect(
        IdentityRegistrationPolicy.evaluate(
          bootstrap,
          email,
          name,
          password,
          subject,
        ),
      ).toBeUndefined();
    }
  });

  it('preserves linking and compensation behavior @spec:AC-268', async () => {
    const customer = customerPort();
    const identity = identityPort();
    customer.createCustomer.mockResolvedValue('customer-44');
    const compensation = new CompensateRegistrationUseCase(customer);
    const registration = new RegisterIdentityUseCase(
      customer,
      identity,
      compensation,
    );
    const command = new RegisterIdentityCommand(
      'buyer@example.test',
      'Buyer',
      'secret',
      'identity-user',
    );

    await registration.execute(command);

    expect(identity.linkExternalIdentity).toHaveBeenCalledWith(
      'customer-44',
      'identity-user',
    );
    expect(customer.linkSubject).toHaveBeenCalledWith(
      'customer-44',
      'identity-user',
    );
    expect(customer.deleteCustomer).not.toHaveBeenCalled();
  });

  it('continues independent cleanup and reports owned-resource failures', async () => {
    const customer = customerPort();
    const identity = identityPort();
    customer.createCustomer.mockResolvedValue('customer-44');
    identity.linkExternalIdentity.mockRejectedValue(new Error('link failed'));
    customer.deleteCustomer.mockRejectedValue(new Error('customer cleanup'));
    identity.deleteUserSessions.mockRejectedValue(new Error('session cleanup'));
    const registration = new RegisterIdentityUseCase(
      customer,
      identity,
      new CompensateRegistrationUseCase(customer),
    );

    const error = await registration
      .execute(
        new RegisterIdentityCommand(
          'buyer@example.test',
          'Buyer',
          'secret',
          'identity-user',
        ),
      )
      .catch((cause: unknown) => cause);

    expect(identity.deleteAccounts).toHaveBeenCalledWith('identity-user');
    expect(identity.deleteUser).toHaveBeenCalledWith('identity-user');
    expect(error).toMatchObject({
      code: 'REGISTRATION_COMPENSATION_FAILED',
      failures: [
        expect.objectContaining({ step: 'wordpress' }),
        expect.objectContaining({ step: 'sessions' }),
      ],
    });
  });

  it('does not delete an unowned customer and preserves a fully compensated cause', async () => {
    const customer = customerPort();
    const identity = identityPort();
    const cause = new Error('customer already exists');
    customer.createCustomer.mockRejectedValue(cause);
    const compensation = new CompensateRegistrationUseCase(customer);
    const registration = new RegisterIdentityUseCase(
      customer,
      identity,
      compensation,
    );

    await expect(
      registration.execute(
        new RegisterIdentityCommand(
          'buyer@example.test',
          'Buyer',
          'secret',
          'identity-user',
        ),
      ),
    ).rejects.toBe(cause);

    expect(customer.deleteCustomer).not.toHaveBeenCalled();
    expect(identity.deleteUser).toHaveBeenCalledWith('identity-user');
  });
});

describe('Identity OAuth client provisioning core', () => {
  it('keeps OAuth failures typed without transport status', () => {
    const cause = new Error('upstream');
    const error = new OAuthError('OAUTH_CLIENT_SEED_FAILED', 'seed failed', {
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      cause,
      code: 'OAUTH_CLIENT_SEED_FAILED',
      name: 'OAuthError',
    });
  });

  it('reconciles existing clients without requesting seed credentials', async () => {
    const clients = provisioningPort();
    clients.findClient.mockImplementation(async (softwareId) =>
      softwareId === 'identity-gateway' ? 'gateway-client' : 'mcp-client',
    );
    const credentials = {
      get: vi.fn<OAuthSeedCredentialsPort['get']>(),
    } satisfies OAuthSeedCredentialsPort;
    const provisioning = new ProvisionOAuthClientsUseCase(clients, credentials);

    await expect(provisioning.execute()).resolves.toEqual({
      gateway: 'gateway-client',
      mcp: 'mcp-client',
    });

    expect(clients.prepareResources).toHaveBeenCalledWith(
      Object.values(OAuthClientProvisioningPolicy.resources),
    );
    expect(OAuthResources.resources).toEqual(
      OAuthClientProvisioningPolicy.resources,
    );
    expect(OAuthResources.delegatedScopes).toEqual(
      OAuthClientProvisioningPolicy.delegatedScopes,
    );
    expect(clients.ensureResourceLinks).toHaveBeenCalledTimes(2);
    expect(credentials.get).not.toHaveBeenCalled();
  });

  it('creates a missing PKCE client with a seed administrator session', async () => {
    const clients = provisioningPort();
    clients.findClient
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('mcp-client');
    clients.openAdministratorSession.mockResolvedValue('session=one');
    clients.createClient.mockResolvedValue('gateway-client');
    const credentials = {
      get: vi
        .fn<OAuthSeedCredentialsPort['get']>()
        .mockReturnValue(
          new OAuthSeedCredentials('admin@example.test', 'secret'),
        ),
    } satisfies OAuthSeedCredentialsPort;
    const provisioning = new ProvisionOAuthClientsUseCase(clients, credentials);

    await expect(provisioning.execute()).resolves.toEqual({
      gateway: 'gateway-client',
      mcp: 'mcp-client',
    });

    expect(clients.openAdministratorSession).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.test' }),
      'Identity client seed',
    );
    expect(clients.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: [
          'openid',
          'profile',
          ...OAuthClientProvisioningPolicy.delegatedScopes,
        ],
        softwareId: 'identity-gateway',
      }),
      'session=one',
    );
  });
});
