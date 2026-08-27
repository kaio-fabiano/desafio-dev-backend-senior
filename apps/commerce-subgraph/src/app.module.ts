import { Module } from '@nestjs/common';

import { CommerceModule } from './graphql/commerce.module.ts';
import { HealthController } from './health.controller.ts';

export class AppModule {}

Module({ controllers: [HealthController], imports: [CommerceModule] })(AppModule);
