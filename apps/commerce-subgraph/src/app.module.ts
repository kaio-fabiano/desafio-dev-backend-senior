import { Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';

import { CommerceModule } from './graphql/commerce.module.ts';
import { HealthController } from './health.controller.ts';
import { connectRabbitMq, type RabbitMqRuntime } from './messaging/rabbitmq.ts';

export class AppModule {}

export class RabbitMqLifecycle implements OnModuleInit, OnApplicationShutdown {
  private runtime?: RabbitMqRuntime;

  async onModuleInit(): Promise<void> {
    this.runtime = await connectRabbitMq(
      process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runtime?.close();
  }
}

Module({
  controllers: [HealthController],
  imports: [CommerceModule],
  providers: [RabbitMqLifecycle],
})(AppModule);
