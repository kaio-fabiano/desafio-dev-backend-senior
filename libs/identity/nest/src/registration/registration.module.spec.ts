import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { WordPressConfiguration } from '../wordpress/wordpress-configuration.provider.ts';
import { CompensateRegistrationUseCase } from '../application/use-cases/compensate-registration.use-case.ts';
import { RegisterIdentityUseCase } from '../application/use-cases/register-identity.use-case.ts';
import { RegistrationModule } from './registration.module.ts';
import { RegistrationService } from './registration.service.ts';

@Injectable()
class RegistrationConsumer {
  constructor(
    @Inject(RegistrationService) readonly registration: RegistrationService,
  ) {}
}

describe('RegistrationModule', () => {
  it('exports registration while keeping its collaborators internal @spec:AC-236 @spec:AC-272', async () => {
    const module = await Test.createTestingModule({
      imports: [RegistrationModule],
      providers: [RegistrationConsumer],
    })
      .overrideProvider(WordPressConfiguration)
      .useValue({
        endpoint: 'https://wordpress.test',
        registrarIdentity: 'identity-registrar',
        siteToken: 'site-token',
      })
      .compile();

    expect(module.get(RegistrationConsumer).registration).toBeInstanceOf(
      RegistrationService,
    );
    expect(module.get(CompensateRegistrationUseCase)).toBeInstanceOf(
      CompensateRegistrationUseCase,
    );
    expect(module.get(RegisterIdentityUseCase)).toBeInstanceOf(
      RegisterIdentityUseCase,
    );

    await module.close();
  });
});
