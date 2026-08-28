import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { MikroORM } from '@mikro-orm/core';

import { AppModule } from './app.module.ts';
import { COMMERCE_ORM } from './graphql/commerce.module.ts';
import { OrderEventBroker } from './subscriptions/order-event-broker.ts';
import { startCommerceMessaging } from './messaging/commerce-messaging.runtime.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const orm = app.get<MikroORM>(COMMERCE_ORM);
  await orm.getMigrator().up();
  const messaging = await startCommerceMessaging({
    orm,
    broker: app.get(OrderEventBroker),
    rabbitMqUrl: process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:5672',
    wordpressUrl: process.env.WORDPRESS_URL ?? 'http://wordpress',
    consumerKey: process.env.WOO_CONSUMER_KEY ?? '',
    consumerSecret: process.env.WOO_CONSUMER_SECRET ?? '',
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
  app.getHttpServer().once('close', () => void messaging.close());
}

void bootstrap();
