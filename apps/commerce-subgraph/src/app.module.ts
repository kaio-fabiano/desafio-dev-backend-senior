import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.ts';

export class AppModule {}

Module({ controllers: [HealthController] })(AppModule);
