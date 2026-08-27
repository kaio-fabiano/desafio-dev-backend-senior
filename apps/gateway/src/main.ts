import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.ts';
import type { AuthContext } from './auth/auth-context.ts';
import { verifyGatewayRequest } from './auth/token-verifier.ts';
import { createCommerceSubscriptionClient } from './subscriptions/commerce-subscription.client.ts';
import { createGatewaySseHandler } from './subscriptions/sse-handler.ts';

type AuthenticatedRequest = IncomingMessage & { authContext?: AuthContext };
type GatewayTokenOptions = Parameters<typeof verifyGatewayRequest>[1];

function toFetchRequest(request: IncomingMessage) {
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    headers.append(request.rawHeaders[index]!, request.rawHeaders[index + 1]!);
  }
  return new Request(
    new URL(
      request.url ?? '/graphql',
      `http://${request.headers.host ?? 'gateway.local'}`,
    ),
    { method: request.method, headers },
  );
}

export function createGatewayAuthMiddleware(
  token: GatewayTokenOptions,
  verify = verifyGatewayRequest,
) {
  return async (
    request: AuthenticatedRequest,
    response: ServerResponse,
    next: () => void,
  ) => {
    try {
      request.authContext = await verify(toFetchRequest(request), token);
      next();
    } catch {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));
    }
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const token = {
    issuer: process.env.OAUTH_ISSUER ?? 'http://localhost:3001/api/auth',
    audience:
      process.env.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
    requiredScopes: ['marketplace:read'],
  };
  const commerce = createCommerceSubscriptionClient({
    url:
      process.env.COMMERCE_SUBSCRIPTION_URL ??
      'http://localhost:3002/graphql/stream',
  });
  const sseHandler = createGatewaySseHandler({
    commerce,
    token,
  });
  const http = app.getHttpAdapter().getInstance();
  http.all('/graphql/stream', sseHandler);
  await app.listen(Number(process.env.PORT ?? 3000));
}

if (import.meta.main) void bootstrap();
