import { Module } from '@nestjs/common';

import { WordPressModule } from '../wordpress/wordpress.module.ts';
import { RegistrationCompensationService } from './registration-compensation.service.ts';
import { RegistrationService } from './registration.service.ts';

@Module({
  imports: [WordPressModule],
  providers: [RegistrationCompensationService, RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
