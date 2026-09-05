import type { MikroORM } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';

import { AppModule } from './app.module.ts';
import { ORDER_WORKFLOW_ORM } from './persistence/persistence.tokens.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const orm = app.get<MikroORM>(ORDER_WORKFLOW_ORM);
  await orm.migrator.up();
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(Number(config.get('PORT', '3000')));
}

if (import.meta.main) void bootstrap();
