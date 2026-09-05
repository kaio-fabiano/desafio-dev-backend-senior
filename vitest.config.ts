import { defineConfig } from 'vitest/config';

const criticalThresholds = {
  branches: 95,
  functions: 100,
  lines: 100,
  statements: 100,
  perFile: true,
} as const;

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    include: [
      'apps/**/*.spec.ts',
      'libs/**/*.spec.ts',
      'apps/e2e/src/milestone-7.e2e.test.ts',
    ],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'libs/gateway/nest/src/auth/*.ts',
        'libs/gateway/nest/src/federation/authenticated-data-source.ts',
        'libs/gateway/nest/src/gateway.module.ts',
        'libs/identity/nest/src/{better-auth,oauth,registration,wordpress}/*.ts',
        'libs/identity/nest/src/graphql/{identity.resolver,user.loader,user.repository}.ts',
        'libs/platform/nest/src/oauth-resource/graphql/*.ts',
        'libs/platform/nest/src/oauth-resource/verification/*.ts',
        'apps/order-workflow-subgraph/src/checkout/{checkout.module,checkout.repository,checkout.service,command-hash,woo-checkout.adapter}.ts',
        'apps/order-workflow-subgraph/src/{inbox/inbox.repository,messaging/messaging.module,messaging/order-workflow-messaging.runtime,messaging/rabbitmq,outbox/outbox.publisher,outbox/outbox.repository,persistence/persistence.module,saga/order-event.consumer,saga/order-saga.repository,saga/order-saga,saga/postgres-order-event.notifier}.ts',
        'apps/order-workflow-subgraph/src/graphql/{authenticated-subject.decorator,order-workflow-graphql.module,order-workflow-operations.service,order-workflow.resolver,sse/sse-handler,sse/sse.middleware}.ts',
        'apps/order-workflow-subgraph/src/health.controller.ts',
        'apps/order-workflow-subgraph/src/order-events/{order-events.module,order-events.subscription,postgres/mikro-orm-order-event.replay}.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      excludeAfterRemap: true,
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
        perFile: true,
        'libs/**/src/{auth,better-auth,oauth,oauth-resource,registration,wordpress}/**/*.ts':
          criticalThresholds,
        'libs/**/*{authorization,idempotency,ownership}*.ts':
          criticalThresholds,
        'libs/gateway/nest/src/federation/authenticated-data-source.ts':
          criticalThresholds,
        'apps/order-workflow-subgraph/src/checkout/{checkout.repository,checkout.service,command-hash,woo-checkout.adapter}.ts':
          criticalThresholds,
        'apps/order-workflow-subgraph/src/{inbox/inbox.repository,outbox/outbox.publisher,outbox/outbox.repository,saga/order-event.consumer,saga/order-saga.repository,saga/order-saga,saga/postgres-order-event.notifier}.ts':
          criticalThresholds,
        'apps/order-workflow-subgraph/src/graphql/{authenticated-subject.decorator,order-workflow-operations.service,order-workflow.resolver}.ts':
          criticalThresholds,
        'apps/order-workflow-subgraph/src/{graphql/sse/sse-handler,graphql/sse/sse.middleware,order-events/order-events.subscription,order-events/postgres/mikro-orm-order-event.replay}.ts':
          criticalThresholds,
      },
    },
  },
});
