import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { WordPressIdentityService } from './wordpress-identity.service.ts';
import { WORDPRESS_CONFIGURATION } from './wordpress.config.ts';
import { WordPressModule } from './wordpress.module.ts';

@Injectable()
class WordPressConsumer {
  constructor(
    @Inject(WordPressIdentityService)
    readonly wordpress: WordPressIdentityService,
  ) {}
}

describe('WordPressModule', () => {
  it('exports WordPressIdentityService to importing modules @spec:AC-236', async () => {
    const module = await Test.createTestingModule({
      imports: [WordPressModule],
      providers: [WordPressConsumer],
    })
      .overrideProvider(WORDPRESS_CONFIGURATION)
      .useValue({
        endpoint: 'https://wordpress.test',
        registrarIdentity: 'identity-registrar',
        siteToken: 'site-token',
      })
      .compile();

    expect(module.get(WordPressConsumer).wordpress).toBeInstanceOf(
      WordPressIdentityService,
    );

    await module.close();
  });
});
