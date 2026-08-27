import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.ts';
import { createCommerceSubscriptionClient } from './subscriptions/commerce-subscription.client.ts';
import { createGatewaySseHandler } from './subscriptions/sse-handler.ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const commerce = createCommerceSubscriptionClient({
    url:
      process.env.COMMERCE_SUBSCRIPTION_URL ??
      'http://localhost:3002/graphql/stream',
  });
  const sseHandler = createGatewaySseHandler({
    commerce,
    token: {
      issuer: process.env.OAUTH_ISSUER ?? 'http://localhost:3001/api/auth',
      audience:
        process.env.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
      requiredScopes: ['marketplace:read'],
    },
  });
  app.getHttpAdapter().getInstance().all('/graphql/stream', sseHandler);
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
