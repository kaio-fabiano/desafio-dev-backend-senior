import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WordPressCustomerIdentityAdapter } from '../infrastructure/wordpress/wordpress-customer-identity.adapter.ts';
import { WordPressConfiguration } from './wordpress-configuration.provider.ts';
import { WordPressIdentityService } from './wordpress-identity.service.ts';

@Module({
  imports: [ConfigModule],
  providers: [
    WordPressConfiguration,
    WordPressIdentityService,
    WordPressCustomerIdentityAdapter,
  ],
  exports: [WordPressIdentityService, WordPressCustomerIdentityAdapter],
})
export class WordPressModule {}
