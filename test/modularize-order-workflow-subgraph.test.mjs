import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');

test('AC-246: persistence has its own module @spec:AC-246', async () => {
  const [persistence, graphql, main] = await Promise.all([
    source(
      'apps/order-workflow-subgraph/src/persistence/persistence.module.ts',
    ),
    source(
      'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
    ),
    source('apps/order-workflow-subgraph/src/main.ts'),
  ]);
  assert.match(persistence, /provide: ORDER_WORKFLOW_ORM/);
  assert.match(persistence, /provide: ORDER_WORKFLOW_ENTITY_MANAGER/);
  assert.match(persistence, /scope: Scope\.REQUEST/);
  assert.doesNotMatch(graphql, /provide: ORDER_WORKFLOW_(ORM|ENTITY_MANAGER)/);
  assert.match(main, /persistence\/persistence\.tokens/);
});

test('AC-247: checkout has its own module @spec:AC-247', async () => {
  const checkout = await source(
    'apps/order-workflow-subgraph/src/checkout/checkout.module.ts',
  );
  assert.match(checkout, /provide: CHECKOUT_REPOSITORY/);
  assert.match(checkout, /provide: OUTBOX_REPOSITORY/);
  assert.match(checkout, /provide: WOO_CHECKOUT/);
  assert.match(checkout, /exports: \[CheckoutService\]/);
});

test('AC-248: order events have a coherent boundary @spec:AC-248', async () => {
  const events = await source(
    'apps/order-workflow-subgraph/src/order-events/order-events.module.ts',
  );
  for (const provider of [
    'OrderEventBroker',
    'OrderEventsSubscription',
    'PostgresOrderEventRelay',
  ]) {
    assert.match(events, new RegExp(provider));
  }
  await access(
    'apps/order-workflow-subgraph/src/graphql/sse/sse.middleware.ts',
  );
  await assert.rejects(
    access(
      'apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts',
    ),
    /ENOENT/,
  );
});

test('AC-249: messaging and saga processing are separated @spec:AC-249', async () => {
  const [messaging, consumer, repository, notifier] = await Promise.all([
    source('apps/order-workflow-subgraph/src/messaging/messaging.module.ts'),
    source('apps/order-workflow-subgraph/src/saga/order-event.consumer.ts'),
    source('apps/order-workflow-subgraph/src/saga/order-saga.repository.ts'),
    source(
      'apps/order-workflow-subgraph/src/saga/postgres-order-event.notifier.ts',
    ),
  ]);
  assert.match(messaging, /providers: \[OrderWorkflowRuntimeLifecycle\]/);
  assert.doesNotMatch(consumer, /select |insert into|update |pg_notify/);
  assert.match(repository, /select workflow|insert into|update /);
  assert.match(notifier, /pg_notify/);
});

test('AC-250: GraphQL is only the transport boundary @spec:AC-250', async () => {
  const graphql = await source(
    'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
  );
  assert.match(graphql, /OrderWorkflowResolver/);
  assert.match(graphql, /OrderWorkflowSubscriptionResolver/);
  assert.match(graphql, /OrderWorkflowOperationsService/);
  assert.match(graphql, /OrderWorkflowSseMiddleware/);
  assert.doesNotMatch(graphql, /OrderWorkflowRuntimeLifecycle/);
  assert.doesNotMatch(graphql, /provide: (ORDER_WORKFLOW_ORM|WOO_CHECKOUT)/);
});

test('AC-251: public contracts retain executable coverage @spec:AC-251', async () => {
  const [schema, project, streamTest, messagingTest, checkoutTest] =
    await Promise.all([
      source('libs/contracts/graphql/order-workflow/schema.graphql'),
      source('apps/order-workflow-subgraph/project.json'),
      source(
        'apps/order-workflow-subgraph/src/graphql/sse/sse.integration.spec.ts',
      ),
      source(
        'apps/order-workflow-subgraph/src/messaging/rabbitmq.integration.spec.ts',
      ),
      source(
        'apps/order-workflow-subgraph/src/checkout/checkout.repository.integration.spec.ts',
      ),
    ]);
  assert.match(
    schema,
    /startCheckout\(input: OrderWorkflowCheckoutInput!\): Order!/,
  );
  assert.match(schema, /orderEvents\(operationKey: ID!\): OrderEvent!/);
  assert.match(project, /vitest run apps\/order-workflow-subgraph/);
  assert.match(streamTest, /@spec:AC-231/);
  assert.match(messagingTest, /@spec:AC-230/);
  assert.match(checkoutTest, /MikroOrmCheckoutRepository/);
});
