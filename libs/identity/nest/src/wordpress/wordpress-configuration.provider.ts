import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WordPressError } from './wordpress.error.ts';

@Injectable()
export class WordPressConfiguration {
  readonly endpoint: string;
  readonly registrarIdentity: string;
  readonly siteToken: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.endpoint = config.get<string>('WORDPRESS_URL', 'http://wordpress');
    this.registrarIdentity = config.get<string>(
      'WORDPRESS_IDENTITY_REGISTRAR',
      'identity-registrar',
    );
    this.siteToken = config.get<string>('WPGRAPHQL_SITE_TOKEN', '');
    if (config.get<string>('NODE_ENV') === 'production' && !this.siteToken) {
      throw new WordPressError(
        'WORDPRESS_CONFIGURATION_INVALID',
        'WPGRAPHQL_SITE_TOKEN is required in production',
      );
    }
  }
}
