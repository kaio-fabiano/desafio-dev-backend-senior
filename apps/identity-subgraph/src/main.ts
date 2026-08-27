import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';

import { AppModule } from './app.module.ts';
import { createIdentityAuth } from './auth/config.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const auth = createIdentityAuth(database, {
    baseURL: process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001',
    secret: process.env.BETTER_AUTH_SECRET ?? 'development-secret-change-me',
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
  });
  const http = app.getHttpAdapter().getInstance();
  http.all(
    '/api/auth/*',
    async (
      request: IncomingMessage & { body?: unknown },
      response: ServerResponse,
    ) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value))
          value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const hasBody =
        request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        request.body !== undefined;
      const protocolRequest = new Request(
        new URL(
          request.url ?? '/',
          process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001',
        ),
        {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        },
      );
      const result = await auth.handler(protocolRequest);
      response.writeHead(
        result.status,
        Object.fromEntries(result.headers.entries()),
      );
      response.end(Buffer.from(await result.arrayBuffer()));
    },
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
