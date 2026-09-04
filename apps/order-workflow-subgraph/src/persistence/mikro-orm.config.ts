import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

import { CheckoutOperation } from './entities/checkout-operation.entity.ts';
import { InboxRecord } from './entities/inbox-record.entity.ts';
import { OrderWorkflow } from './entities/order-workflow.entity.ts';
import { OutboxEvent } from './entities/outbox-event.entity.ts';
// TODO: Avaliar essa implementaćao do mikro-orm, aparentemente existe uma lib pra nestJS
// TODO: Avaliar como foi configurada as migrations pois por ter bancos em redes diferentes talvez de merda como foi feito
export default defineConfig({
  dbName: process.env.ORDER_WORKFLOW_DB_NAME ?? 'order_workflow',
  host: process.env.ORDER_WORKFLOW_DB_HOST ?? 'postgres',
  port: Number(process.env.ORDER_WORKFLOW_DB_PORT ?? 5432),
  user: process.env.ORDER_WORKFLOW_DB_USER ?? 'postgres',
  password: process.env.ORDER_WORKFLOW_DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  entities: [CheckoutOperation, InboxRecord, OrderWorkflow, OutboxEvent],
  extensions: [Migrator],
  migrations: {
    path: 'apps/order-workflow-subgraph/src/persistence/migrations',
    glob: 'Migration*.ts',
    transactional: true,
    allOrNothing: true,
  },
});
