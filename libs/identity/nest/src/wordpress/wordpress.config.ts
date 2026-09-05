import { type FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WordPressError } from './wordpress.error.ts';

export type WordPressConfiguration = {
  endpoint: string;
  registrarIdentity: string;
  siteToken: string;
};

export const WORDPRESS_CONFIGURATION = Symbol('WORDPRESS_CONFIGURATION');

export const wordpressConfigurationProvider: FactoryProvider<WordPressConfiguration> =
  {
    provide: WORDPRESS_CONFIGURATION,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const endpoint = config.get<string>('WORDPRESS_URL', 'http://wordpress');
      const registrarIdentity = config.get<string>(
        'WORDPRESS_IDENTITY_REGISTRAR',
        'identity-registrar',
      );
      const siteToken = config.get<string>('WPGRAPHQL_SITE_TOKEN', '');
      if (config.get<string>('NODE_ENV') === 'production' && !siteToken) {
        throw new WordPressError(
          'WORDPRESS_CONFIGURATION_INVALID',
          'WPGRAPHQL_SITE_TOKEN is required in production',
        );
      }
      return { endpoint, registrarIdentity, siteToken };
    },
  };
