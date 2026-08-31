import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

import { CheckoutOperation } from './entities/checkout-operation.entity.ts';
import { InboxRecord } from './entities/inbox-record.entity.ts';
import { OrderWorkflow } from './entities/order-workflow.entity.ts';
import { OutboxEvent } from './entities/outbox-event.entity.ts';

export default defineConfig({
  dbName: process.env.COMMERCE_DB_NAME ?? 'commerce',
  host: process.env.COMMERCE_DB_HOST ?? 'postgres',
  port: Number(process.env.COMMERCE_DB_PORT ?? 5432),
  user: process.env.COMMERCE_DB_USER ?? 'postgres',
  password: process.env.COMMERCE_DB_PASSWORD,
  entities: [CheckoutOperation, InboxRecord, OrderWorkflow, OutboxEvent],
  extensions: [Migrator],
  migrations: {
    path: 'apps/commerce-subgraph/src/persistence/migrations',
    glob: 'Migration*.ts',
    transactional: true,
    allOrNothing: true,
  },
});
