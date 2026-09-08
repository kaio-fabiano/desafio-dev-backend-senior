import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const coreFiles = [
  'application/commands/register-identity.command.ts',
  'application/dto/oauth-client-definition.dto.ts',
  'application/dto/oauth-client-ids.dto.ts',
  'application/dto/oauth-seed-credentials.dto.ts',
  'application/dto/registration-compensation-failure.dto.ts',
  'application/errors/oauth.error.ts',
  'application/errors/registration.error.ts',
  'application/ports/customer-identity.port.ts',
  'application/ports/identity-account.port.ts',
  'application/ports/oauth-client-provisioning.port.ts',
  'application/ports/oauth-seed-credentials.port.ts',
  'application/use-cases/compensate-registration.use-case.ts',
  'application/use-cases/find-identity-users.use-case.ts',
  'application/use-cases/list-identity-users.use-case.ts',
  'application/use-cases/provision-oauth-clients.use-case.ts',
  'application/use-cases/register-identity.use-case.ts',
  'domain/policies/identity-registration.policy.ts',
] as const;

async function coreSources(): Promise<Array<[string, string]>> {
  return Promise.all(
    coreFiles.map(async (file) => [
      file,
      await readFile(new URL(file, import.meta.url), 'utf8'),
    ]),
  );
}

describe('Identity core architecture', () => {
  it('keeps dependency direction inward @spec:AC-256', async () => {
    const sources = await coreSources();

    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(
        /from ['"](?:@apollo|graphql|better-auth|@thallesp|@mikro-orm|pg)/,
      );
      expect(source, file).not.toMatch(/from ['"]@nestjs\/(?!common['"])/);
      if (file.startsWith('domain/')) {
        expect(source, file).not.toMatch(/from ['"]@nestjs/);
      }
      if (source.includes("from '@nestjs/common'")) {
        expect(file).toMatch(/^application\/use-cases\//);
        expect(source, file).toContain(
          "import { Inject, Injectable } from '@nestjs/common';",
        );
      }
    }
  });

  it('uses focused classes and abstract-class ports @spec:AC-257', async () => {
    const sources = await coreSources();

    for (const [file, source] of sources) {
      expect(source.match(/export (?:abstract )?class /g), file).toHaveLength(
        1,
      );
      expect(source, file).not.toMatch(
        /^export (?:interface|type|enum|function|const)\b/m,
      );
      if (file.endsWith('.port.ts')) {
        expect(source, file).toMatch(/export abstract class /);
      }
    }
  });

  it('keeps registration and provisioning free of outer concerns @spec:AC-262', async () => {
    const sources = (await coreSources())
      .map(([, source]) => source)
      .join('\n');

    expect(sources).not.toMatch(
      /NestJS|GraphQL|Better Auth|WordPress|database|HTTP|fetch\(|process\.env|\bHeaders\b|\bResponse\b/,
    );
  });

  it('moves characterized orchestration behind use cases @spec:AC-268 @principle:P-003', async () => {
    const [registration, provisioning] = await Promise.all([
      readFile(
        new URL('registration/registration.service.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          'oauth-issuer/oauth-client-provisioning.service.ts',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);

    expect(registration).toContain('RegisterIdentityUseCase');
    expect(provisioning).toContain('ProvisionOAuthClientsUseCase');
  });
});
