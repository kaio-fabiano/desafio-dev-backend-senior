import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.ts';

export { createGatewayAuthMiddleware } from '@desafio-dev-backend-senior/gateway-nest';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

if (import.meta.main) void bootstrap();
