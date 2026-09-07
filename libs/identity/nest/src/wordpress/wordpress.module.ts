import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WordPressConfiguration } from './wordpress-configuration.provider.ts';
import { WordPressIdentityService } from './wordpress-identity.service.ts';

@Module({
  imports: [ConfigModule],
  providers: [WordPressConfiguration, WordPressIdentityService],
  exports: [WordPressIdentityService],
})
export class WordPressModule {}
