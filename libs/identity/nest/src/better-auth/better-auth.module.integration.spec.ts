import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { Test } from '@nestjs/testing';
import {
  AFTER_HOOK_KEY,
  AuthService,
  HOOK_KEY,
} from '@thallesp/nestjs-better-auth';
import { describe, expect, it, vi } from 'vitest';

import { BetterAuthModule } from './better-auth.module.ts';
import { BetterAuthFactory } from './better-auth.factory.ts';
import { RegistrationService } from '../registration/registration.service.ts';
import { WORDPRESS_CONFIGURATION } from '../wordpress/wordpress.config.ts';
import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';

describe('BetterAuthModule', () => {
  it('composes focused authentication modules @spec:AC-236', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      BetterAuthModule,
    ) as Array<{ name?: string }>;

    expect(imports.map((importedModule) => importedModule.name)).toEqual(
      expect.arrayContaining(['RegistrationModule']),
    );
  });

  it('lets Nest own the auth instance and registration hooks @spec:AC-227', async () => {
    const auth = {
      api: {},
      options: { basePath: '/api/auth', hooks: {} },
    };
    const module = await Test.createTestingModule({
      imports: [BetterAuthModule],
    })
      .overrideProvider(BetterAuthFactory)
      .useValue({ create: vi.fn().mockReturnValue(auth) })
      .overrideProvider(WORDPRESS_CONFIGURATION)
      .useValue({
        endpoint: 'https://wordpress.test',
        registrarIdentity: 'identity-registrar',
        siteToken: 'site-token',
      })
      .compile();

    expect(module.get(AuthService).instance).toBe(auth);
    expect(module.get(RegistrationService)).toBeInstanceOf(RegistrationService);
    expect(module.get(WordPressIdentityService)).toBeInstanceOf(
      WordPressIdentityService,
    );
    expect(Reflect.getMetadata(HOOK_KEY, RegistrationService)).toBe(true);
    expect(
      Reflect.getMetadata(
        AFTER_HOOK_KEY,
        RegistrationService.prototype.afterEmailSignUp,
      ),
    ).toBe('/sign-up/email');
    await module.close();
  });
});
