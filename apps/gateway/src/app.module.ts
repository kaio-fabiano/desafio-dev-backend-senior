import { Module } from '@nestjs/common';

import { GatewayModule } from '@desafio-dev-backend-senior/gateway-nest';
import { HealthController } from './health.controller.ts';

/**
 * GatewayModule owns ApolloGatewayDriver, LocalCompose, contract('catalog'),
 * and IDENTITY_JWKS_URL configuration; this application is only its boundary.
 */
export class AppModule {}

Module({ imports: [GatewayModule], controllers: [HealthController] })(
  AppModule,
);
