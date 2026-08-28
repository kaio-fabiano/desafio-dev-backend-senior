import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import {
  WORDPRESS_FEDERATION_CONFIG,
  type WordPressFederationConfig,
} from '../../../libs/wordpress/nest/src/index.ts';
import { AppModule } from './app.module.ts';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const { port } = app.get<WordPressFederationConfig>(
    WORDPRESS_FEDERATION_CONFIG,
  );
  app.enableShutdownHooks();
  await app.listen(port);
}

if (import.meta.main) void bootstrap();
