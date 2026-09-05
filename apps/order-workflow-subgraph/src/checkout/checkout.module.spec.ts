import { Scope, type InjectionToken, type Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import { CheckoutModule } from './checkout.module.ts';
import { CheckoutService } from './checkout.service.ts';
import {
  CHECKOUT_REPOSITORY,
  OUTBOX_REPOSITORY,
  WOO_CHECKOUT,
} from './checkout.tokens.ts';

describe('CheckoutModule', () => {
  it('owns request-scoped checkout providers and exports CheckoutService', async () => {
    const providers = Reflect.getMetadata(
      'providers',
      CheckoutModule,
    ) as Provider[];
    const exports = Reflect.getMetadata('exports', CheckoutModule) as unknown[];
    const findProvider = (token: InjectionToken) =>
      providers.find(
        (candidate) =>
          typeof candidate === 'object' && candidate.provide === token,
      );
    const provider = (token: InjectionToken) => {
      const match = findProvider(token);
      if (!match || !('useFactory' in match)) {
        throw new Error(`Missing factory for ${String(token)}`);
      }
      return match;
    };

    expect(provider(CHECKOUT_REPOSITORY).scope).toBe(Scope.REQUEST);
    expect(provider(CHECKOUT_REPOSITORY).useFactory({} as never)).toBeDefined();
    expect(provider(CheckoutService).scope).toBe(Scope.REQUEST);
    expect(
      provider(CheckoutService).useFactory(
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toBeInstanceOf(CheckoutService);
    expect(findProvider(WOO_CHECKOUT)).toBeDefined();
    expect(exports).toContain(CheckoutService);

    const outboxProvider = findProvider(OUTBOX_REPOSITORY);
    if (!outboxProvider) throw new Error('Missing outbox provider');
    const testingModule = await Test.createTestingModule({
      providers: [outboxProvider],
    }).compile();
    try {
      expect(testingModule.get(OUTBOX_REPOSITORY)).toBeInstanceOf(
        MikroOrmOutboxRepository,
      );
    } finally {
      await testingModule.close();
    }
  });

  it('builds the WooCommerce adapter from required environment values', () => {
    const providers = Reflect.getMetadata(
      'providers',
      CheckoutModule,
    ) as Provider[];
    const woo = providers.find(
      (candidate) =>
        typeof candidate === 'object' && candidate.provide === WOO_CHECKOUT,
    );
    if (!woo || !('useFactory' in woo)) {
      throw new Error('Missing WooCommerce factory');
    }
    const wordpressUrl = process.env.WORDPRESS_URL;
    const siteToken = process.env.WPGRAPHQL_SITE_TOKEN;
    process.env.WORDPRESS_URL = 'http://wordpress.test';
    process.env.WPGRAPHQL_SITE_TOKEN = 'site-token';

    try {
      expect(woo.useFactory()).toBeDefined();
    } finally {
      restoreEnvironment('WORDPRESS_URL', wordpressUrl);
      restoreEnvironment('WPGRAPHQL_SITE_TOKEN', siteToken);
    }
  });

  it('rejects missing WooCommerce environment values', () => {
    const providers = Reflect.getMetadata(
      'providers',
      CheckoutModule,
    ) as Provider[];
    const woo = providers.find(
      (candidate) =>
        typeof candidate === 'object' && candidate.provide === WOO_CHECKOUT,
    );
    if (!woo || !('useFactory' in woo)) {
      throw new Error('Missing WooCommerce factory');
    }
    const wordpressUrl = process.env.WORDPRESS_URL;
    const siteToken = process.env.WPGRAPHQL_SITE_TOKEN;
    process.env.WORDPRESS_URL = 'http://wordpress.test';
    delete process.env.WPGRAPHQL_SITE_TOKEN;

    try {
      expect(() => woo.useFactory()).toThrow(
        'WPGRAPHQL_SITE_TOKEN is required',
      );
    } finally {
      restoreEnvironment('WORDPRESS_URL', wordpressUrl);
      restoreEnvironment('WPGRAPHQL_SITE_TOKEN', siteToken);
    }
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
