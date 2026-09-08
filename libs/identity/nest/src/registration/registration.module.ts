import { Module } from '@nestjs/common';

import { CustomerIdentityPort } from '../application/ports/customer-identity.port.ts';
import { CompensateRegistrationUseCase } from '../application/use-cases/compensate-registration.use-case.ts';
import { RegisterIdentityUseCase } from '../application/use-cases/register-identity.use-case.ts';
import { WordPressCustomerIdentityAdapter } from '../infrastructure/wordpress/wordpress-customer-identity.adapter.ts';
import { WordPressModule } from '../wordpress/wordpress.module.ts';
import { RegistrationService } from './registration.service.ts';

@Module({
  imports: [WordPressModule],
  providers: [
    {
      provide: CustomerIdentityPort,
      useExisting: WordPressCustomerIdentityAdapter,
    },
    CompensateRegistrationUseCase,
    RegisterIdentityUseCase,
    RegistrationService,
  ],
  exports: [RegistrationService],
})
export class RegistrationModule {}
