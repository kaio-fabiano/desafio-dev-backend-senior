import { Module } from '@nestjs/common';

import { IdentityModule } from '../../../libs/identity/nest/src/index.ts';
import { HealthController } from './health.controller.ts';

export class AppModule {}

Module({ imports: [IdentityModule], controllers: [HealthController] })(
  AppModule,
);
