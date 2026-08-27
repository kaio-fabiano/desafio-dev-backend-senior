import { Pool } from 'pg';

import { PostgresInboxRepository } from './inventory/inbox.repository.ts';
import { createWooInventoryAdapter } from './inventory/woo-inventory.adapter.ts';
import { createInventoryWorker } from './main.ts';
import { connectStockBroker, consumeStock, publishInventory } from './messaging/rabbitmq.runtime.ts';

export class StockWorkerLifecycle {
  private broker?: Awaited<ReturnType<typeof connectStockBroker>>;
  private database?: Pool;

  async start(): Promise<void> {
    this.database = new Pool({ connectionString: process.env.STOCK_DATABASE_URL ?? postgresUrl() });
    await this.database.query(`create table if not exists stock_worker_inbox (
      event_id text primary key,
      result jsonb not null,
      received_at timestamptz not null default current_timestamp
    )`);
    this.broker = await connectStockBroker(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
    const worker = createInventoryWorker({
      inbox: new PostgresInboxRepository(this.database),
      inventory: createWooInventoryAdapter({
        endpoint: process.env.WOO_URL ?? 'http://localhost:8080',
        consumerKey: requiredEnvironment('WOO_CONSUMER_KEY'),
        consumerSecret: requiredEnvironment('WOO_CONSUMER_SECRET'),
      }),
      publisher: { publish: (event) => publishInventory(this.broker!.channel, event) },
    });
    await consumeStock(this.broker.channel, async (event) => {
      await worker.consume(event, async () => {});
    });
  }

  async stop(): Promise<void> {
    await this.broker?.close();
    await this.database?.end();
  }
}

function postgresUrl(): string {
  const host = process.env.STOCK_DB_HOST ?? 'localhost';
  const database = process.env.STOCK_DB_NAME ?? 'commerce';
  const user = process.env.STOCK_DB_USER ?? 'postgres';
  const password = process.env.STOCK_DB_PASSWORD ?? 'postgres';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function bootstrap(): Promise<void> {
  const lifecycle = new StockWorkerLifecycle();
  await lifecycle.start();
  const stop = () => void lifecycle.stop().finally(() => process.exit(0));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (process.argv[1]?.endsWith('/app.module.ts')) void bootstrap();
