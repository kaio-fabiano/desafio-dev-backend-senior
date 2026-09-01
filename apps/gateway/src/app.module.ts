import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module, RequestMethod } from '@nestjs/common';

import { GatewayModule } from '@desafio-dev-backend-senior/source/gateway-nest';
import { HealthController } from './health.controller.ts';
import { GatewaySseMiddleware } from './subscriptions/sse.middleware.ts';

/**
 * GatewayModule owns ApolloGatewayDriver, LocalCompose, contract('catalog'),
 * and IDENTITY_JWKS_URL configuration; this application is only its boundary.
 */
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GatewaySseMiddleware).forRoutes({
      path: 'graphql/stream',
      method: RequestMethod.ALL,
    });
  }
}

Module({
  imports: [GatewayModule],
  controllers: [HealthController],
  providers: [GatewaySseMiddleware],
})(AppModule);
