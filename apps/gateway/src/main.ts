import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, type NextFunction, type Request, type Response } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module.ts';

export { createGatewayAuthMiddleware } from '@desafio-dev-backend-senior/source/gateway-nest';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const parseJson = json();
  app.use(
    '/graphql',
    (request: Request, response: Response, next: NextFunction) =>
      request.path === '/stream' ? next() : parseJson(request, response, next),
  );
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(Number(config.get('PORT', '3000')));
}

if (import.meta.main) void bootstrap();
