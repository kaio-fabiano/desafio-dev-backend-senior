import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';
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
        IdentityErrorMessages.wordpress.WORDPRESS_CONFIGURATION_INVALID,
      );
    }
  }
}
