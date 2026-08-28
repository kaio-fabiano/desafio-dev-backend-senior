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
const STREAM_QUEUE = 'commerce-order-events.v1';
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
  const streamRabbit = await connectRabbitMq(rabbitMqUrl);
  const publisherRabbit = await connectRabbitMq(rabbitMqUrl);
  await declareConsumerQueue(consumerRabbit.channel, QUEUE, TRANSITIONS);
  await declareConsumerQueue(streamRabbit.channel, STREAM_QUEUE, [
    'order.workflow-transitioned',
  ]);
  const publisher = new ConfirmedRabbitMqPublisher(publisherRabbit.channel);
  const outbox = new OutboxPublisher(
    orm.em.fork(),
    new MikroOrmOutboxRepository(),
    publisher,
  );
  const transitions = new OrderTransitionPublisher({
    publish: (event) => publisher.publish(event),
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
      await consumer.consume(
        JSON.parse(message.content.toString('utf8')) as OrderSagaEvent,
      );
    },
    1,
  );
  await consumeWithRetry(
    streamRabbit.channel,
    STREAM_QUEUE,
    async (message) => {
      const event = JSON.parse(
        message.content.toString('utf8'),
      ) as OrderWorkflowTransitionedEvent;
      broker.publish({
        subject: event.subject,
        operationKey: event.operationKey,
        payload: event.payload,
      });
    },
    32,
  );
  void publish();

  return {
    async close() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await Promise.all([
        consumerRabbit.close(),
        streamRabbit.close(),
        publisherRabbit.close(),
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
