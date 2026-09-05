import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';

import { IdentityAuthBootstrap } from '@desafio-dev-backend-senior/source/identity-nest';
import { AppModule } from './app.module.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bootstrapIdentityAuth = app.get(IdentityAuthBootstrap);
  // The provider also owns the compatibility `/oauth/clients` endpoint.
  void bootstrapIdentityAuth;
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(Number(config.get('PORT', '3000')));
}

void bootstrap();
