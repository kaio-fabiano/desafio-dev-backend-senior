import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  CartAuthorizationError,
  CartInputError,
  CartService,
} from '../apps/commerce-subgraph/src/cart/cart.service.ts';
import {
  CheckoutIdempotencyConflictError,
  CheckoutService,
} from '../apps/commerce-subgraph/src/checkout/checkout.service.ts';
import { CommerceResolver } from '../apps/commerce-subgraph/src/graphql/commerce.resolver.ts';
import { createOrderLoader } from '../apps/gateway/src/catalog/order-loader.ts';
import { createProductLoader } from '../apps/gateway/src/catalog/product-loader.ts';
import { createCatalogRequestMetrics } from '../apps/gateway/src/catalog/request-metrics.ts';

function acceptanceHarness() {
  const carts = new Map();
  const operations = new Map();
  const workflows = new Map();
  const remoteOrders = new Map();
  const events = [];
  let remoteCreations = 0;
  let confirmation = Promise.resolve();
  let failConfirmation = false;

  const cart = new CartService({
    async addItem(subject, { productId, quantity }) {
      const items = carts.get(subject) ?? new Map();
      items.set(String(productId), (items.get(String(productId)) ?? 0) + quantity);
      carts.set(subject, items);
      return { subject, items: [...items].map(([id, itemQuantity]) => ({ id, quantity: itemQuantity })) };
    },
    async removeItem(subject, { itemKey, quantity }) {
      const items = carts.get(subject) ?? new Map();
      const remaining = Math.max(0, (items.get(itemKey) ?? 0) - quantity);
      if (remaining) items.set(itemKey, remaining);
      else items.delete(itemKey);
      return { subject, items: [...items].map(([id, itemQuantity]) => ({ id, quantity: itemQuantity })) };
    },
  });

  const checkout = new CheckoutService({
    async claim(input) {
      const key = `${input.subject}:${input.operationKey}`;
      let operation = operations.get(key);
      if (!operation) {
        operation = { id: `operation-${operations.size + 1}`, ...input, status: 'PENDING_WOO' };
        operations.set(key, operation);
        return { operation, created: true };
      }
      return { operation, created: false };
    },
    async confirm(operationId, wooOrderId, _stockItems, onConfirmed) {
      const preceding = confirmation;
      let release;
      confirmation = new Promise((resolve) => { release = resolve; });
      await preceding;
      try {
        const existing = workflows.get(operationId);
        if (existing) return existing;
        const operation = [...operations.values()].find(({ id }) => id === operationId);
        const transaction = { event: undefined };
        const workflow = { id: `workflow-${operationId}`, checkoutOperationId: operationId, wooOrderId };
        await onConfirmed(transaction, workflow);
        if (failConfirmation) {
          failConfirmation = false;
          throw new Error('simulated local confirmation failure');
        }
        workflows.set(operationId, workflow);
        events.push(transaction.event);
        operation.wooOrderId = wooOrderId;
        operation.status = 'COMPLETED';
        return workflow;
      } finally {
        release();
      }
    },
  }, {
    async enqueueCheckoutRequested(transaction, workflowId, event) {
      transaction.event = { workflowId, event, sentAt: undefined };
    },
  }, {
    async createOrFind({ reference, subject, cartSnapshot }) {
      await Promise.resolve();
      let order = remoteOrders.get(reference);
      if (!order) {
        remoteCreations += 1;
        order = { id: String(remoteCreations), wooOrderId: String(remoteCreations), reference, subject, productIds: cartSnapshot.items.map(({ productId }) => String(productId)) };
        remoteOrders.set(reference, order);
      }
      return order;
    },
  });

  const resolver = new CommerceResolver(
    cart,
    (subject, input) => checkout.checkout({
      subject,
      ...input,
      cartSnapshot: { items: [...(carts.get(subject) ?? [])].map(([productId, quantity]) => ({ productId: Number(productId), quantity })) },
    }),
    async (wooOrderId) => [...workflows.values()].find((workflow) => workflow.wooOrderId === wooOrderId) ?? null,
  );

  return {
    cart,
    checkout,
    carts,
    events,
    operations,
    remoteCreations: () => remoteCreations,
    remoteOrders,
    resolver,
    setFailConfirmation: () => { failConfirmation = true; },
    workflows,
  };
}

const context = { subject: 'buyer-a', scopes: ['marketplace:read'], audience: ['gateway'], requestId: 'request-1' };
const checkoutInput = { operationKey: 'operation-1', paymentMethod: 'CARD' };

test('AC-033: Cart mutations use the authenticated buyer in the acceptance journey @spec:AC-033', async () => {
  const { resolver, carts } = acceptanceHarness();
  const added = await resolver.addToCart(context, '42', 2);
  const removed = await resolver.removeFromCart(context, '42', 1);
  assert.equal(added.subject, context.subject);
  assert.equal(removed.subject, context.subject);
  assert.equal(carts.get(context.subject).get('42'), 1);
  assert.equal(carts.has('buyer-b'), false);
});

test('AC-034: Invalid cart changes leave the acceptance cart unchanged @spec:AC-034', async () => {
  const { cart, resolver, carts } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  assert.throws(() => resolver.addToCart(context, '42', 0), CartInputError);
  assert.throws(() => cart.addItem(context.subject, { productId: 42, quantity: 1, subject: 'buyer-b' }), CartAuthorizationError);
  assert.deepEqual([...carts.get(context.subject)], [['42', 1]]);
});

test('AC-035: Sequential acceptance retries return the original order @spec:AC-035', async () => {
  const { resolver, remoteCreations } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  const first = await resolver.checkout(context, checkoutInput);
  const retry = await resolver.checkout(context, checkoutInput);
  assert.deepEqual(retry, first);
  assert.equal(remoteCreations(), 1);
});

test('AC-036: Concurrent acceptance retries create one order @spec:AC-036', async () => {
  const { resolver, operations, remoteCreations, workflows } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  const results = await Promise.all(Array.from({ length: 12 }, () => resolver.checkout(context, checkoutInput)));
  assert.equal(new Set(results.map(({ wooOrderId }) => wooOrderId)).size, 1);
  assert.equal(operations.size, 1);
  assert.equal(workflows.size, 1);
  assert.equal(remoteCreations(), 1);
});

test('AC-037: Reusing an acceptance key for a different command conflicts @spec:AC-037', async () => {
  const { resolver, remoteCreations } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  await resolver.checkout(context, checkoutInput);
  await assert.rejects(
    resolver.checkout(context, { ...checkoutInput, paymentMethod: 'PIX' }),
    CheckoutIdempotencyConflictError,
  );
  assert.equal(remoteCreations(), 1);
});

test('AC-038: Pending WooCommerce acceptance checkout is reconciled @spec:AC-038', async () => {
  const { checkout, resolver, remoteCreations, setFailConfirmation, workflows } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  setFailConfirmation();
  await assert.rejects(resolver.checkout(context, checkoutInput), /confirmation failure/);
  const recovered = await checkout.reconcile({
    subject: context.subject,
    ...checkoutInput,
    cartSnapshot: { items: [{ productId: 42, quantity: 1 }] },
  });
  assert.equal(recovered.wooOrderId, '1');
  assert.equal(remoteCreations(), 1);
  assert.equal(workflows.size, 1);
});

test('AC-039: Acceptance workflow and event are committed together @spec:AC-039', async () => {
  const { events, resolver, setFailConfirmation, workflows } = acceptanceHarness();
  await resolver.addToCart(context, '42', 1);
  setFailConfirmation();
  await assert.rejects(resolver.checkout(context, checkoutInput));
  assert.equal(workflows.size, 0);
  assert.equal(events.length, 0);
  await resolver.checkout(context, checkoutInput);
  assert.equal(workflows.size, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].workflowId, [...workflows.values()][0].id);
});

test('AC-040: Federated acceptance me returns orders, workflow, and products @spec:AC-040', async () => {
  const harness = acceptanceHarness();
  await harness.resolver.addToCart(context, '42', 1);
  await harness.resolver.addToCart(context, '84', 2);
  await harness.resolver.checkout(context, checkoutInput);
  const orderMetrics = createCatalogRequestMetrics();
  const productMetrics = createCatalogRequestMetrics();
  const orderLoader = createOrderLoader(async (requests) => requests.map(({ subject }) => ({
    edges: [...harness.remoteOrders.values()].filter((order) => order.subject === subject).map((node) => ({ node })),
    pageInfo: { hasNextPage: false, endCursor: null },
  })), orderMetrics);
  const productLoader = createProductLoader(async (ids) => ids.map((id) => ({ id })), productMetrics);
  const [mine, theirs] = await Promise.all([orderLoader.load(context.subject), orderLoader.load('buyer-b')]);
  const order = mine.edges[0].node;
  const [workflow, products] = await Promise.all([
    harness.resolver.workflow(order),
    Promise.all(order.productIds.map((id) => productLoader.load(id))),
  ]);
  assert.equal(theirs.edges.length, 0);
  assert.equal(workflow.wooOrderId, order.id);
  assert.deepEqual(products, [{ id: '42' }, { id: '84' }]);
  assert.deepEqual(orderMetrics, { calls: 1, batches: [2] });
  assert.deepEqual(productMetrics, { calls: 1, batches: [2] });
});

test('Milestone 3 acceptance is archived behind the current E2E gate', async () => {
  const [compose, config, project, e2eProject, runbook] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    readFile('onpspec.config.json', 'utf8').then(JSON.parse),
    readFile('apps/commerce-subgraph/project.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    readFile('docs/runbooks/milestone-3-cart-order.md', 'utf8'),
  ]);
  assert.match(compose, /postgres:17\.6-bookworm/);
  assert.match(compose, /wordpress:6\.8\.2-php8\.3-apache/);
  assert.match(config.testCommand, /test\/milestone-3-cart-order\.test\.mjs/);
  assert.equal(project.projectType, 'library');
  assert.ok(project.tags.includes('type:retired'));
  assert.equal(project.targets.acceptance, undefined);
  assert.match(e2eProject.targets.acceptance.options.command, /milestone-7\.e2e\.test\.ts/);
  assert.match(runbook, /docker compose --project-name milestone-3-cart-order up --detach --wait/);
});
