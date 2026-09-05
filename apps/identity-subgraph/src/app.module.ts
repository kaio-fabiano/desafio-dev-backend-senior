import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IdentityModule } from '@desafio-dev-backend-senior/source/identity-nest';
import { HealthController } from './health.controller.ts';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    IdentityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
