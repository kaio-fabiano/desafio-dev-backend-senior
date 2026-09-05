import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WordPressIdentityService } from './wordpress-identity.service.ts';
import { wordpressConfigurationProvider } from './wordpress.config.ts';

@Module({
  imports: [ConfigModule],
  providers: [wordpressConfigurationProvider, WordPressIdentityService],
  exports: [WordPressIdentityService],
})
export class WordPressModule {}
