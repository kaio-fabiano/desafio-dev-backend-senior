import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { MikroORM } from '@mikro-orm/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { json, type NextFunction, type Request, type Response } from 'express';

import { AppModule } from './app.module.ts';
import { COMMERCE_ORM } from './graphql/commerce.module.ts';
import { OrderEventBroker } from './subscriptions/order-event-broker.ts';
import { startCommerceMessaging } from './messaging/commerce-messaging.runtime.ts';
import {
  createCommerceSseHandler,
  registerDeferredSseRoute,
} from './subscriptions/sse-handler.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const parseJson = json();
  app.use(
    '/graphql',
    (request: Request, response: Response, next: NextFunction) =>
      request.path === '/stream' ? next() : parseJson(request, response, next),
  );
  const activateSse = registerDeferredSseRoute(
    app.getHttpAdapter().getInstance(),
    '/graphql/stream',
  );
  const orm = app.get<MikroORM>(COMMERCE_ORM);
  await orm.getMigrator().up();
  const messaging = await startCommerceMessaging({
    orm,
    broker: app.get(OrderEventBroker),
    rabbitMqUrl: process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:5672',
  });
  app.enableShutdownHooks();
  await app.init();
  activateSse(createCommerceSseHandler(app.get(GraphQLSchemaHost).schema));
  await app.listen(Number(process.env.PORT ?? 3000));
  app.getHttpServer().once('close', () => void messaging.close());
}

void bootstrap();
