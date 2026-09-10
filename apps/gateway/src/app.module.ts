import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import {
  ForwardGatewaySubscriptionUseCase,
  GatewayModule,
  OrderWorkflowSubscriptionPort,
} from '@desafio-dev-backend-senior/source/gateway-nest';
import { HealthController } from './health.controller.ts';
import { OrderWorkflowSubscriptionClient } from './subscriptions/order-workflow-subscription.client.ts';
import { GatewaySseHandler } from './subscriptions/sse-handler.ts';
import { GatewaySseMiddleware } from './subscriptions/sse.middleware.ts';

/**
 * GatewayModule owns ApolloGatewayDriver, local federation contracts, and
 * identity resource configuration; this application is only its boundary.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    GatewayModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: OrderWorkflowSubscriptionClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OrderWorkflowSubscriptionClient(
          config.get<string>('ORDER_WORKFLOW_SUBSCRIPTION_URL') ??
            'http://payment-federation:8080/graphql',
        ),
    },
    {
      provide: OrderWorkflowSubscriptionPort,
      useExisting: OrderWorkflowSubscriptionClient,
    },
    ForwardGatewaySubscriptionUseCase,
    GatewaySseHandler,
    GatewaySseMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GatewaySseMiddleware).forRoutes({
      path: 'graphql/stream',
      method: RequestMethod.ALL,
    });
  }
}
