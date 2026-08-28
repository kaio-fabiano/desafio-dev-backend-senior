import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { MikroORM } from '@mikro-orm/core';

import { AppModule } from './app.module.ts';
import { COMMERCE_ORM } from './graphql/commerce.module.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.get<MikroORM>(COMMERCE_ORM).getMigrator().up();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
