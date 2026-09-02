import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { LocalCompose } from '@apollo/gateway';
import { parse } from 'graphql';

async function sources(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(
    entries.flatMap((entry) => {
      const path = `${root}/${entry.name}`;
      if (entry.isDirectory())
        return [sources(path).then((items) => items.join('\n'))];
      return entry.name.endsWith('.java') ? [readFile(path, 'utf8')] : [];
    }),
  );
}

test('AC-145: workflow, payment and inventory progress through RabbitMQ @spec:AC-145', async () => {
  const [workflowRuntime, workflowOutbox, paymentListener, inventoryListener] =
    await Promise.all([
      readFile(
        'apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts',
        'utf8',
      ),
      readFile(
        'apps/order-workflow-subgraph/src/outbox/outbox.repository.ts',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
        'utf8',
      ),
    ]);

  assert.match(workflowOutbox, /payment\.requested/);
  assert.match(paymentListener, /RabbitListener/);
  assert.match(inventoryListener, /RabbitListener/);
  assert.doesNotMatch(workflowRuntime, /fetch\(|payment-federation/);
});

test('AC-148: Payment application depends on a provider port, not a vendor SDK @spec:AC-148', async () => {
  const [provider, handler, domain, application] = await Promise.all([
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/application/PaymentProvider.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/application/PaymentHandler.java',
      'utf8',
    ),
    sources('apps/payment-federation/src/main/java/dev/desafio/payment/domain'),
    sources(
      'apps/payment-federation/src/main/java/dev/desafio/payment/application',
    ),
  ]);

  assert.match(provider, /interface PaymentProvider/);
  assert.match(provider, /operationKey/);
  assert.match(handler, /PaymentProvider/);
  assert.match(handler, /provider\.execute/);
  assert.doesNotMatch(
    [...domain, ...application].join('\n'),
    /com\.stripe|mercadopago|pagarme|adyen|paypal/i,
  );
});

test('AC-149: Inventory is an independent asynchronous participant @spec:AC-149', async () => {
  const [paymentCore, inventory, listener, runtime] = await Promise.all([
    Promise.all([
      sources(
        'apps/payment-federation/src/main/java/dev/desafio/payment/domain',
      ),
      sources(
        'apps/payment-federation/src/main/java/dev/desafio/payment/application',
      ),
    ]),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/inventory/InventoryService.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
      'utf8',
    ),
  ]);

  assert.match(inventory, /class InventoryService/);
  assert.match(listener, /INVENTORY_QUEUE/);
  assert.match(runtime, /stock\.reservation-requested/);
  assert.match(paymentCore.flat(2).join('\n'), /payment\.authorized/);
  assert.doesNotMatch(paymentCore.flat(2).join('\n'), /InventoryService/);
});

test('AC-150: ADRs record native capability, gap, alternatives and removal @spec:AC-150', async () => {
  const decisions = await Promise.all([
    readFile('docs/adrs/008-native-commerce-and-order-workflow.md', 'utf8'),
    readFile('docs/adrs/009-payment-provider-port.md', 'utf8'),
  ]);
  const source = decisions.join('\n');

  assert.match(source, /WooGraphQL/);
  assert.match(source, /does not provide|do not provide/);
  assert.match(source, /Alternatives considered/);
  assert.match(source, /remov(?:al|ed)/i);
});

test('AC-151: the four-subgraph contract composes @spec:AC-151', async () => {
  const names = ['identity', 'wordpress', 'payment', 'order-workflow'];
  const localServiceList = await Promise.all(
    names.map(async (name) => ({
      name,
      url: `http://${name}/graphql`,
      typeDefs: parse(
        await readFile(`libs/contracts/graphql/${name}/schema.graphql`, 'utf8'),
      ),
    })),
  );
  const manager = new LocalCompose({ localServiceList });
  const result = await manager.initialize({ getDataSource: () => ({}) });

  assert.match(result.supergraphSdl, /order-workflow/);
  assert.doesNotMatch(result.supergraphSdl, /commerce-subgraph/);
});
