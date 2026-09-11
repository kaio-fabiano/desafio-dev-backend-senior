import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');
const java = 'apps/payment-federation/src/main/java/dev/desafio/transaction';

test('AC-246: persistence has its own boundary @spec:AC-246', async () => {
  const [migration, configuration] = await Promise.all([
    source('apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql'),
    source(`${java}/transaction/configuration/TransactionConfiguration.java`),
  ]);
  assert.match(migration, /transaction\.checkout_operation/);
  assert.match(migration, /transaction\.transaction_view/);
  assert.match(configuration, /JdbcCheckoutOperationRepository/);
  assert.match(configuration, /JdbcTransactionViewStore/);
});

test('AC-247: checkout has its own application boundary @spec:AC-247', async () => {
  const configuration = await source(`${java}/transaction/configuration/TransactionConfiguration.java`);
  assert.match(configuration, /CheckoutOperationRepository/);
  assert.match(configuration, /WooCommerceOrderPort/);
  assert.match(configuration, /CheckoutService/);
});

test('AC-248: order events have a coherent boundary @spec:AC-248', async () => {
  const [controller, handler] = await Promise.all([
    source(`${java}/transaction/interfaces/graphql/TransactionSubscriptionController.java`),
    source(`${java}/transaction/application/subscription/OnTransactionUpdatedHandler.java`),
  ]);
  assert.match(controller, /orderEvents/);
  assert.match(controller, /onTransactionUpdated/);
  assert.match(handler, /subscribeByOperationKey/);
});

test('AC-249: messaging participants are separated without a saga coordinator @spec:AC-249', async () => {
  const [transaction, inventory, payment] = await Promise.all([
    source(`${java}/transaction/adapter/messaging/TransactionRabbitListener.java`),
    source(`${java}/inventory/adapter/messaging/AxonInventoryRabbitListener.java`),
    source(`${java}/payment/adapter/messaging/AxonPaymentRabbitListener.java`),
  ]);
  for (const participant of [transaction, inventory, payment]) assert.match(participant, /RabbitListener/);
  assert.doesNotMatch(`${transaction}\n${inventory}\n${payment}`, /SagaManager|Coordinator/);
});

test('AC-250: GraphQL is only the transport boundary @spec:AC-250', async () => {
  const controller = await source(`${java}/shared/interfaces/graphql/CheckoutGraphQlController.java`);
  assert.match(controller, /Controller/);
  assert.match(controller, /ReactorCommandGateway/);
  assert.match(controller, /ReactorQueryGateway/);
  assert.doesNotMatch(controller, /Jdbc|DataSource|RabbitTemplate/);
});

test('AC-251: public contracts retain executable coverage @spec:AC-251', async () => {
  const [schema, project, graphqlTest, messagingTest, checkoutTest] = await Promise.all([
    source('libs/contracts/graphql/order-workflow/schema.graphql'),
    source('apps/payment-federation/project.json'),
    source('apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java'),
    source('apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java'),
    source('apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java'),
  ]);
  assert.match(schema, /startCheckout\(input: OrderWorkflowCheckoutInput!\): Order!/);
  assert.match(schema, /orderEvents\(operationKey: ID!\): OrderEvent!/);
  assert.match(project, /gradle/);
  assert.match(graphqlTest, /@spec:AC-288/);
  assert.match(messagingTest, /@spec:AC-293/);
  assert.match(checkoutTest, /@spec:AC-285/);
});
