import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.ts';
import { IdentityAuthBootstrap } from '@desafio-dev-backend-senior/identity-nest';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bootstrapIdentityAuth = app.get(IdentityAuthBootstrap);
  // The provider also owns the compatibility `/oauth/clients` endpoint.
  void bootstrapIdentityAuth;
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
