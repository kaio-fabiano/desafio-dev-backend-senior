import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';

import { AppModule } from './app.module.ts';
import { createIdentityAuth } from './auth/config.ts';
import { toBetterAuthRequest } from './auth/http-bridge.ts';
import { bootstrapIdentityAuth } from './auth/seed.ts';
import { createRegistrationHandler } from './registration/registration-handler.ts';
import { createWordPressIdentityAdapter } from './registration/wordpress-identity.adapter.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const auth = createIdentityAuth(database, {
    baseURL: process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001',
    issuer:
      process.env.OAUTH_ISSUER ?? 'https://identity-subgraph:3001/api/auth',
    secret: process.env.BETTER_AUTH_SECRET ?? 'development-secret-change-me',
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
  });
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && !seedPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required in production');
  }
  const clients = await bootstrapIdentityAuth(auth, {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
    password: seedPassword ?? 'local-admin-password-change-before-production',
  });
  const wordpressEndpoint = process.env.WORDPRESS_URL ?? 'http://wordpress';
  const wooConsumerKey = process.env.WOO_CONSUMER_KEY;
  const wooConsumerSecret = process.env.WOO_CONSUMER_SECRET;
  if (
    process.env.NODE_ENV === 'production' &&
    (!wooConsumerKey || !wooConsumerSecret)
  ) {
    throw new Error(
      'WOO_CONSUMER_KEY and WOO_CONSUMER_SECRET are required in production',
    );
  }
  const register = createRegistrationHandler(
    auth,
    createWordPressIdentityAdapter({
      endpoint: wordpressEndpoint,
      consumerKey: wooConsumerKey ?? '',
      consumerSecret: wooConsumerSecret ?? '',
    }),
  );
  const http = app.getHttpAdapter().getInstance();
  http.get(
    '/oauth/clients',
    (_request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          gateway: clients.gateway.clientId,
          mcp: clients.mcp.clientId,
        }),
      );
    },
  );
  http.use(
    '/api/auth',
    async (
      request: IncomingMessage & { body?: unknown; originalUrl?: string },
      response: ServerResponse,
    ) => {
      const protocolRequest = await toBetterAuthRequest(
        request,
        process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001',
      );
      const result =
        protocolRequest.method === 'POST' &&
        new URL(protocolRequest.url).pathname === '/api/auth/sign-up/email'
          ? await register(protocolRequest)
          : await auth.handler(protocolRequest);
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
