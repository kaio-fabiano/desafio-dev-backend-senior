import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module.ts';
import { createCommerceSubscriptionClient } from './subscriptions/commerce-subscription.client.ts';
import { createGatewaySseHandler } from './subscriptions/sse-handler.ts';

export { createGatewayAuthMiddleware } from '@desafio-dev-backend-senior/source/gateway-nest';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const parseJson = json();
  app.use(
    '/graphql',
    (request: Request, response: Response, next: NextFunction) =>
      request.path === '/stream' ? next() : parseJson(request, response, next),
  );
  app
    .getHttpAdapter()
    .getInstance()
    .all(
      '/graphql/stream',
      createGatewaySseHandler({
        commerce: createCommerceSubscriptionClient({
          url:
            process.env.COMMERCE_SUBSCRIPTION_URL ??
            'http://commerce-subgraph:3003/graphql/stream',
        }),
        token: {
          issuer:
            process.env.OAUTH_ISSUER ??
            'http://identity-subgraph:3001/api/auth',
          jwksUrl:
            process.env.IDENTITY_JWKS_URL ??
            'http://identity-subgraph:3001/api/auth/jwks',
          audience:
            process.env.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
          requiredScopes: [],
        },
      }),
    );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

if (import.meta.main) void bootstrap();
