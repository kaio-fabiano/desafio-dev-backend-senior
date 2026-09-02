import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import type { MikroORM } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { json, type NextFunction, type Request, type Response } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module.ts';
import { ORDER_WORKFLOW_ORM } from './graphql/order-workflow.module.ts';
import {
  createOrderWorkflowSseHandler,
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
  const orm = app.get<MikroORM>(ORDER_WORKFLOW_ORM);
  await orm.getMigrator().up();
  app.enableShutdownHooks();
  await app.init();
  const oauth = app.get(OAuthResourceService);
  activateSse(
    createOrderWorkflowSseHandler(
      app.get(GraphQLSchemaHost).schema,
      (request) => oauth.verify(request),
    ),
  );
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
