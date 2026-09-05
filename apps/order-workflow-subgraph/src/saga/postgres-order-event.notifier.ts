import type { EntityManager } from '@mikro-orm/core';

import { ORDER_TRANSITION_CHANNEL } from '../order-events/order-event.channel.ts';

export interface TransactionalOrderEventNotifier {
  notify(transaction: EntityManager, workflowId: string): Promise<void>;
}

export class PostgresTransactionalOrderEventNotifier
  implements TransactionalOrderEventNotifier
{
  notify(transaction: EntityManager, workflowId: string): Promise<void> {
    return transaction
      .getConnection()
      .execute(
        'select pg_notify(?, ?)',
        [ORDER_TRANSITION_CHANNEL, workflowId],
        'all',
        transaction.getTransactionContext(),
      )
      .then(() => undefined);
  }
}
