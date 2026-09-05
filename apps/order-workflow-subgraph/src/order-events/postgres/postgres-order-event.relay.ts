import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Client, type Notification } from 'pg';

import { OrderEventBroker } from '../order-event-broker.ts';
import { ORDER_TRANSITION_CHANNEL } from '../order-event.channel.ts';
import type { OrderEventReplay } from '../order-events.subscription.ts';

/** Cross-replica live delivery; durable replay remains in PostgreSQL tables. */
@Injectable()
export class PostgresOrderEventRelay
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private client?: Client;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    private readonly broker: OrderEventBroker,
    private readonly replay: Required<Pick<OrderEventReplay, 'byWorkflowId'>>,
    private readonly createClient: () => Client = () =>
      new Client({
        database: process.env.ORDER_WORKFLOW_DB_NAME ?? 'order_workflow',
        host: process.env.ORDER_WORKFLOW_DB_HOST ?? 'postgres',
        port: Number(process.env.ORDER_WORKFLOW_DB_PORT ?? 5432),
        user: process.env.ORDER_WORKFLOW_DB_USER ?? 'postgres',
        password: process.env.ORDER_WORKFLOW_DB_PASSWORD,
        ssl:
          process.env.NODE_ENV === 'production' &&
          process.env.ORDER_WORKFLOW_DB_SSL !== 'false'
            ? { rejectUnauthorized: false }
            : undefined,
      }),
  ) {}

  get connected(): boolean {
    return this.client !== undefined;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const client = this.client;
    this.client = undefined;
    await client?.end().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    const client = this.createClient();
    client.on('notification', (notification) => this.receive(notification));
    client.on('error', () => this.reconnect(client));
    await client.connect();
    await client.query(`listen ${ORDER_TRANSITION_CHANNEL}`);
    if (this.stopped) {
      await client.end();
      return;
    }
    this.client = client;
  }

  private reconnect(failed: Client): void {
    if (this.stopped || this.client !== failed) return;
    this.client = undefined;
    this.broker.disconnect(
      new Error('Order event relay disconnected; reconnect subscription'),
    );
    void failed.end().catch(() => undefined);
    this.reconnectTimer = setTimeout(
      () => void this.connect().catch(() => this.reconnectLater()),
      1_000,
    );
  }

  private reconnectLater(): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(
      () => void this.connect().catch(() => this.reconnectLater()),
      1_000,
    );
  }

  private receive(notification: Notification): void {
    const workflowId = notification.payload;
    if (!workflowId || !isUuid(workflowId)) return;
    void this.replay
      .byWorkflowId(workflowId)
      .then((event) => {
        if (event) this.broker.publish(event);
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            component: 'order-workflow-event-relay',
            error: error instanceof Error ? error.message : 'unknown error',
            status: 'replay-failed',
            workflowId,
          }),
        );
        this.broker.disconnect(
          new Error('Order event replay failed; reconnect subscription'),
        );
      });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
