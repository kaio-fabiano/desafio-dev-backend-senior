import type { EntityManager } from '@mikro-orm/core';
import { Module, Scope } from '@nestjs/common';

import {
  MikroOrmOutboxRepository,
  type OutboxRepository,
} from '../outbox/outbox.repository.ts';
import { PersistenceModule } from '../persistence/persistence.module.ts';
import { ORDER_WORKFLOW_ENTITY_MANAGER } from '../persistence/persistence.tokens.ts';
import {
  MikroOrmCheckoutRepository,
  type CheckoutRepository,
} from './checkout.repository.ts';
import { CheckoutService } from './checkout.service.ts';
import {
  CHECKOUT_REPOSITORY,
  OUTBOX_REPOSITORY,
  WOO_CHECKOUT,
} from './checkout.tokens.ts';
import { createWooCheckoutAdapter } from './woo-checkout.adapter.ts';
import type { WooCheckoutPort } from './woo-checkout.port.ts';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

@Module({
  imports: [PersistenceModule],
  providers: [
    {
      provide: WOO_CHECKOUT,
      useFactory: () =>
        createWooCheckoutAdapter(requiredEnvironment('WORDPRESS_URL'), {
          serviceIdentity: 'order-workflow',
          siteToken: requiredEnvironment('WPGRAPHQL_SITE_TOKEN'),
        }),
    },
    {
      provide: CHECKOUT_REPOSITORY,
      scope: Scope.REQUEST,
      inject: [ORDER_WORKFLOW_ENTITY_MANAGER],
      useFactory: (entityManager: EntityManager) =>
        new MikroOrmCheckoutRepository(entityManager),
    },
    { provide: OUTBOX_REPOSITORY, useClass: MikroOrmOutboxRepository },
    {
      provide: CheckoutService,
      scope: Scope.REQUEST,
      inject: [CHECKOUT_REPOSITORY, OUTBOX_REPOSITORY, WOO_CHECKOUT],
      useFactory: (
        checkouts: CheckoutRepository,
        outbox: OutboxRepository,
        wooCheckout: WooCheckoutPort,
      ) => new CheckoutService(checkouts, outbox, wooCheckout),
    },
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
