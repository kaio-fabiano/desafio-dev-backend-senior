import 'reflect-metadata';

import {
  WORDPRESS_FEDERATION_CONFIG,
  type WordPressFederationConfig,
} from '@desafio-dev-backend-senior/source/wordpress-nest';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';
import { AppModule } from './app.module.ts';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const parseJson = json();
  app.use(
    '/webhooks/woocommerce',
    json({
      verify: (request, _response, body) => {
        (request as typeof request & { rawBody?: Buffer }).rawBody = body;
      },
    }),
  );
  app.use(
    '/graphql',
    (request: Request, response: Response, next: NextFunction) =>
      request.path === '/stream' ? next() : parseJson(request, response, next),
  );
  const { port } = app.get<WordPressFederationConfig>(
    WORDPRESS_FEDERATION_CONFIG,
  );
  app.enableShutdownHooks();
  await app.listen(port);
}

if (import.meta.main) void bootstrap();
