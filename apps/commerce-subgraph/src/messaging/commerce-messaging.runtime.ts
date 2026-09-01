import type { EntityManager, MikroORM } from '@mikro-orm/core';

import { MikroOrmInboxRepository } from '../inbox/inbox.repository.ts';
import { OutboxPublisher } from '../outbox/outbox.publisher.ts';
import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import {
  MikroOrmOrderSagaRepository,
  OrderEventConsumer,
} from '../saga/order-event.consumer.ts';
import type { OrderSagaEvent } from '../saga/order-saga.ts';
import { OrderEventBroker } from '../subscriptions/order-event-broker.ts';
import { OrderTransitionPublisher } from '../subscriptions/order-transition.publisher.ts';
import type { OrderWorkflowTransitionedEvent } from './rabbitmq.ts';
import {
  ConfirmedRabbitMqPublisher,
  connectRabbitMq,
  consumeWithRetry,
  declareConsumerQueue,
} from './rabbitmq.ts';

export const COMMERCE_QUEUE = 'commerce-subgraph.v1';
export const COMMERCE_EVENT_ROUTING_KEYS = [
  'payment.authorized',
  'payment.pix-generated',
  'payment.refunded',
  'stock.reservation-failed',
  'stock.reserved',
] as const;

export async function startCommerceMessaging({
  orm,
  broker,
  rabbitMqUrl,
}: {
  orm: MikroORM;
  broker: OrderEventBroker;
  rabbitMqUrl: string;
}) {
  const consumerRabbit = await connectRabbitMq(rabbitMqUrl);
  const outboxRabbit = await connectRabbitMq(rabbitMqUrl);
  const failureRabbit = await connectRabbitMq(rabbitMqUrl);
  await declareConsumerQueue(
    consumerRabbit.channel,
    COMMERCE_QUEUE,
    COMMERCE_EVENT_ROUTING_KEYS,
  );
  const outboxPublisher = new ConfirmedRabbitMqPublisher(outboxRabbit.channel);
  const outbox = new OutboxPublisher(
    orm.em.fork(),
    new MikroOrmOutboxRepository(),
    outboxPublisher,
  );
  const transitions = new OrderTransitionPublisher({
    async publish(event) {
      const transition = event as OrderWorkflowTransitionedEvent;
      broker.publish({
        subject: transition.subject,
        operationKey: transition.operationKey,
        payload: transition.payload,
      });
    },
  });
  const consumer = new OrderEventConsumer(
    orm.em.fork(),
    new MikroOrmInboxRepository(),
    new MikroOrmOrderSagaRepository(),
    createOrderItemsLoader(),
    undefined,
    transitions,
  );
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = async () => {
    if (stopped) return;
    try {
      const published = await outbox.publishBatch();
      if (published > 0)
        console.info(`Published ${published} Commerce outbox event(s)`);
    } catch (error) {
      // The row stays unsent and is retried; readiness must survive broker races.
      console.error('Commerce outbox publication failed', error);
    } finally {
      if (!stopped) timer = setTimeout(() => void publish(), 100);
    }
  };
  await consumeWithRetry(
    consumerRabbit.channel,
    COMMERCE_QUEUE,
    async (message) => {
      const event = JSON.parse(
        message.content.toString('utf8'),
      ) as OrderSagaEvent;
      console.info(
        JSON.stringify({
          component: 'commerce-subgraph',
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
            component: 'commerce-subgraph',
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
            component: 'commerce-subgraph',
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
  void publish();

  return {
    async close() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await Promise.all([
        consumerRabbit.close(),
        outboxRabbit.close(),
        failureRabbit.close(),
      ]);
    },
  };
}

function createOrderItemsLoader() {
  return async (transaction: EntityManager, workflowId: string) => {
    const rows = (await transaction
      .getConnection()
      .execute(
        'select "stock_items" from "commerce_order_workflow" where "id" = ?',
        [workflowId],
      )) as Array<{
      stock_items: Array<{ productId: string; quantity: number }>;
    }>;
    return rows[0]?.stock_items ?? [];
  };
}
