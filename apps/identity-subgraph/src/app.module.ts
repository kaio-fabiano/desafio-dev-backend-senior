import { Module } from '@nestjs/common';

import { IdentityModule } from '@desafio-dev-backend-senior/identity-nest';
import { HealthController } from './health.controller.ts';

export class AppModule {}

Module({ imports: [IdentityModule], controllers: [HealthController] })(
  AppModule,
);
