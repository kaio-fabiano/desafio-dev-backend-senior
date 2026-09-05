import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { WORDPRESS_CONFIGURATION } from '../wordpress/wordpress.config.ts';
import { RegistrationModule } from './registration.module.ts';
import { RegistrationService } from './registration.service.ts';

@Injectable()
class RegistrationConsumer {
  constructor(
    @Inject(RegistrationService) readonly registration: RegistrationService,
  ) {}
}

describe('RegistrationModule', () => {
  it('exports registration while keeping its collaborators internal @spec:AC-236', async () => {
    const module = await Test.createTestingModule({
      imports: [RegistrationModule],
      providers: [RegistrationConsumer],
    })
      .overrideProvider(WORDPRESS_CONFIGURATION)
      .useValue({
        endpoint: 'https://wordpress.test',
        registrarIdentity: 'identity-registrar',
        siteToken: 'site-token',
      })
      .compile();

    expect(module.get(RegistrationConsumer).registration).toBeInstanceOf(
      RegistrationService,
    );

    await module.close();
  });
});
