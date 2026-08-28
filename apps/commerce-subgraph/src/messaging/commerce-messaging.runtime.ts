import type { MikroORM } from '@mikro-orm/core';

import { MikroOrmInboxRepository } from '../inbox/inbox.repository.ts';
import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import { OutboxPublisher } from '../outbox/outbox.publisher.ts';
import {
  MikroOrmOrderSagaRepository,
  OrderEventConsumer,
} from '../saga/order-event.consumer.ts';
import type { OrderSagaEvent } from '../saga/order-saga.ts';
import { OrderEventBroker } from '../subscriptions/order-event-broker.ts';
import { OrderTransitionPublisher } from '../subscriptions/order-transition.publisher.ts';
import {
  ConfirmedRabbitMqPublisher,
  connectRabbitMq,
  consumeWithRetry,
  declareConsumerQueue,
} from './rabbitmq.ts';
import type { OrderWorkflowTransitionedEvent } from './rabbitmq.ts';

const QUEUE = 'commerce-subgraph.v1';
const TRANSITIONS = [
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
  wordpressUrl,
  consumerKey,
  consumerSecret,
}: {
  orm: MikroORM;
  broker: OrderEventBroker;
  rabbitMqUrl: string;
  wordpressUrl: string;
  consumerKey: string;
  consumerSecret: string;
}) {
  const consumerRabbit = await connectRabbitMq(rabbitMqUrl);
  const outboxRabbit = await connectRabbitMq(rabbitMqUrl);
  const failureRabbit = await connectRabbitMq(rabbitMqUrl);
  await declareConsumerQueue(consumerRabbit.channel, QUEUE, TRANSITIONS);
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
    createOrderItemsLoader(wordpressUrl, consumerKey, consumerSecret),
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
    QUEUE,
    async (message) => {
      const event = JSON.parse(
        message.content.toString('utf8'),
      ) as OrderSagaEvent;
      console.info(JSON.stringify({
        component: 'commerce-subgraph',
        eventId: event.eventId,
        eventType: event.eventType,
        status: 'received',
      }));
      try {
        const result = await consumer.consume(event);
        console.info(JSON.stringify({
          component: 'commerce-subgraph',
          eventId: event.eventId,
          eventType: event.eventType,
          outcome: result.outcome,
          status: 'completed',
        }));
      } catch (error) {
        console.error(JSON.stringify({
          component: 'commerce-subgraph',
          eventId: event.eventId,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : 'unknown error',
          status: 'failed',
        }));
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

function createOrderItemsLoader(
  endpoint: string,
  consumerKey: string,
  consumerSecret: string,
) {
  const authorization = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;
  return async (orderId: string) => {
    const response = await fetch(
      new URL(`/wp-json/wc/v3/orders/${encodeURIComponent(orderId)}`, endpoint),
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          authorization,
          ...(new URL(endpoint).protocol === 'http:'
            ? { 'x-forwarded-proto': 'https' }
            : {}),
        },
      },
    );
    if (!response.ok)
      throw new Error(`WooCommerce order items failed: ${response.status}`);
    const order = (await response.json()) as {
      line_items?: Array<{ product_id: number; quantity: number }>;
    };
    return (order.line_items ?? []).map(({ product_id, quantity }) => ({
      productId: String(product_id),
      quantity,
    }));
  };
}
