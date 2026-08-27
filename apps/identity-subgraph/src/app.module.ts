import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.ts';
import { IdentityModule } from './graphql/identity.module.ts';

export class AppModule {}

Module({ imports: [IdentityModule], controllers: [HealthController] })(
  AppModule,
);
