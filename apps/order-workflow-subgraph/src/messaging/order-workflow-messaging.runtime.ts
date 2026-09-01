import type { EntityManager, MikroORM } from '@mikro-orm/core';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { ORDER_WORKFLOW_ORM } from '../graphql/order-workflow.tokens.ts';
import { MikroOrmInboxRepository } from '../inbox/inbox.repository.ts';
import { OutboxPublisher } from '../outbox/outbox.publisher.ts';
import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import {
  MikroOrmOrderSagaRepository,
  OrderEventConsumer,
  PostgresTransactionalOrderEventNotifier,
} from '../saga/order-event.consumer.ts';
import type { OrderSagaEvent } from '../saga/order-saga.ts';
import {
  ConfirmedRabbitMqPublisher,
  connectRabbitMq,
  consumeWithRetry,
  declareConsumerQueue,
} from './rabbitmq.ts';

export const ORDER_WORKFLOW_QUEUE = 'order-workflow-subgraph.v1';
export const ORDER_WORKFLOW_EVENT_ROUTING_KEYS = [
  'payment.authorized',
  'payment.pix-generated',
  'payment.refunded',
  'stock.reservation-failed',
  'stock.reserved',
] as const;

export async function startOrderWorkflowMessaging({
  orm,
  rabbitMqUrl,
  onDisconnected = () => undefined,
}: {
  orm: MikroORM;
  rabbitMqUrl: string;
  onDisconnected?: () => void;
}) {
  const connections: Awaited<ReturnType<typeof connectRabbitMq>>[] = [];
  try {
    connections.push(await connectRabbitMq(rabbitMqUrl));
    connections.push(await connectRabbitMq(rabbitMqUrl));
    connections.push(await connectRabbitMq(rabbitMqUrl));
  } catch (error) {
    await Promise.allSettled(
      connections.map((connection) => connection.close()),
    );
    throw error;
  }
  const [consumerRabbit, outboxRabbit, failureRabbit] = connections;
  for (const runtime of [consumerRabbit, outboxRabbit, failureRabbit]) {
    runtime.channel.once('close', onDisconnected);
  }
  try {
    await declareConsumerQueue(
      consumerRabbit.channel,
      ORDER_WORKFLOW_QUEUE,
      ORDER_WORKFLOW_EVENT_ROUTING_KEYS,
    );
  } catch (error) {
    await Promise.allSettled(
      connections.map((connection) => connection.close()),
    );
    throw error;
  }
  const outboxPublisher = new ConfirmedRabbitMqPublisher(outboxRabbit.channel);
  const outbox = new OutboxPublisher(
    orm.em.fork(),
    new MikroOrmOutboxRepository(),
    outboxPublisher,
  );
  const consumer = new OrderEventConsumer(
    orm.em.fork(),
    new MikroOrmInboxRepository(),
    new MikroOrmOrderSagaRepository(
      new PostgresTransactionalOrderEventNotifier(),
    ),
    createOrderItemsLoader(),
  );
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = async () => {
    if (stopped) return;
    try {
      const published = await outbox.publishBatch();
      if (published > 0)
        console.info(`Published ${published} OrderWorkflow outbox event(s)`);
    } catch (error) {
      // The row stays unsent and is retried; readiness must survive broker races.
      console.error('OrderWorkflow outbox publication failed', error);
    } finally {
      if (!stopped) timer = setTimeout(() => void publish(), 100);
    }
  };
  try {
    await consumeWithRetry(
      consumerRabbit.channel,
      ORDER_WORKFLOW_QUEUE,
      async (message) => {
        const event = JSON.parse(
          message.content.toString('utf8'),
        ) as OrderSagaEvent;
        console.info(
          JSON.stringify({
            component: 'order-workflow-subgraph',
            eventId: event.eventId,
            eventType: event.eventType,
            operationKey: event.payload.operationKey,
            status: 'received',
          }),
        );
        try {
          const result = await consumer.consume(event);
          console.info(
            JSON.stringify({
              component: 'order-workflow-subgraph',
              eventId: event.eventId,
              eventType: event.eventType,
              operationKey: event.payload.operationKey,
              outcome: result.outcome,
              status: 'completed',
            }),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              component: 'order-workflow-subgraph',
              eventId: event.eventId,
              eventType: event.eventType,
              operationKey: event.payload.operationKey,
              error: error instanceof Error ? error.message : 'unknown error',
              status: 'failed',
            }),
          );
          throw error;
        }
      },
      1,
      failureRabbit.channel,
    );
  } catch (error) {
    await Promise.allSettled(
      connections.map((connection) => connection.close()),
    );
    throw error;
  }
  void publish();
  let closePromise: Promise<void> | undefined;

  return {
    async close() {
      closePromise ??= (async () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        const results = await Promise.allSettled(
          connections.map((connection) => connection.close()),
        );
        const failure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        );
        if (failure) throw failure.reason;
      })();
      await closePromise;
    },
  };
}

@Injectable()
export class OrderWorkflowRuntimeLifecycle
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private messaging?: Awaited<ReturnType<typeof startOrderWorkflowMessaging>>;
  private available = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectPromise?: Promise<void>;
  private reconnecting = false;
  private stopping = false;

  constructor(@Inject(ORDER_WORKFLOW_ORM) private readonly orm: MikroORM) {}

  get connected(): boolean {
    return this.available;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    this.available = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.reconnectPromise;
      await this.messaging?.close();
    } finally {
      await this.orm.close(true);
    }
  }

  private async connect(): Promise<void> {
    this.messaging = await startOrderWorkflowMessaging({
      orm: this.orm,
      rabbitMqUrl: process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:5672',
      onDisconnected: () => this.scheduleReconnect(),
    });
    this.available = true;
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnecting || this.reconnectTimer) return;
    this.available = false;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.reconnectPromise = this.reconnect().finally(() => {
        this.reconnectPromise = undefined;
      });
    }, 1_000);
  }

  private async reconnect(): Promise<void> {
    if (this.stopping) return;
    this.reconnecting = true;
    await this.messaging?.close().catch((error: unknown) => {
      console.error(
        'Failed to close disconnected OrderWorkflow runtime',
        error,
      );
    });
    if (this.stopping) {
      this.reconnecting = false;
      return;
    }
    try {
      await this.connect();
    } catch (error) {
      console.error(
        'Failed to reconnect OrderWorkflow messaging runtime',
        error,
      );
      this.reconnecting = false;
      this.scheduleReconnect();
      return;
    }
    if (this.stopping) {
      this.available = false;
      await this.messaging?.close().catch((error: unknown) => {
        console.error(
          'Failed to close OrderWorkflow runtime during shutdown',
          error,
        );
      });
    }
    this.reconnecting = false;
  }
}

function createOrderItemsLoader() {
  return async (transaction: EntityManager, workflowId: string) => {
    const rows = (await transaction
      .getConnection()
      .execute(
        'select "stock_items" from "order_workflow_order_workflow" where "id" = ?',
        [workflowId],
      )) as Array<{
      stock_items: Array<{ productId: string; quantity: number }>;
    }>;
    return rows[0]?.stock_items ?? [];
  };
}
