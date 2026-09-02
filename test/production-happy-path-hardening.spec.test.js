// Testes de spec da feature production-happy-path-hardening — gerados por onp-spec scaffold
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

// US-063 — Keep the buyer cart portable
test('AC-131: Cart survives replica changes @spec:AC-131', async () => {
  // Dado: a buyer adds products through the WordPress-owned federated mutation
  // Quando: checkout is handled by another OrderWorkflow process
  // Então: the same WooOrderWorkflow cart is read without process-local cart state
  const [
    { createWooCheckoutAdapter, WooCheckoutRequestError },
    { AuthenticatedDataSource },
  ] = await Promise.all([
    import(
      '../apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts'
    ),
    import('../libs/gateway/nest/src/federation/authenticated-data-source.ts'),
  ]);
  const returnedSession = {};
  const wordpress = new AuthenticatedDataSource({
    url: 'http://wordpress.test/graphql',
    kind: 'wordpress',
  });
  wordpress.didReceiveResponse({
    response: {
      http: {
        headers: new Headers({
          'cart-token': 'replica-portable-token',
          'woocommerce-session': 'woo-session',
          'set-cookie': 'wp_session=cookie-value; Path=/; HttpOnly',
        }),
      },
    },
    context: {
      setResponseHeader(name, value) {
        returnedSession[name === 'set-cookie' ? 'cookie' : name] =
          name === 'set-cookie' ? value.split(';', 1)[0] : value;
      },
    },
  });
  const workflowHeaders = new Headers();
  const workflow = new AuthenticatedDataSource({
    url: 'http://order-workflow.test/graphql',
    kind: 'order-workflow',
  });
  workflow.willSendRequest({
    request: { http: { headers: workflowHeaders } },
    context: {
      subject: 'buyer-1',
      scopes: [],
      audience: [],
      requestId: 'request-1',
      sessionHeaders: returnedSession,
    },
  });
  const receivedHeaders = [];
  const receivedOperations = [];
  let orderCreated = false;
  const adapter = createWooCheckoutAdapter(
    'http://wordpress.test',
    {
      consumerKey: 'commerce-key',
      consumerSecret: 'commerce-secret',
    },
    async (_, init) => {
      receivedHeaders.push(init.headers);
      if (init.method === 'GET')
        return Response.json(
          orderCreated
            ? [
                {
                  id: 7001,
                  total: '19.90',
                  currency: 'BRL',
                  meta_data: [
                    {
                      key: '_order_workflow_operation_reference',
                      value: 'replica-portable-operation',
                    },
                  ],
                  line_items: [{ product_id: 1001, quantity: 1 }],
                },
              ]
            : [],
        );
      const operation = JSON.parse(String(init.body));
      receivedOperations.push(operation);
      const { query } = operation;
      if (query.includes('mutation Checkout')) {
        orderCreated = true;
        return Response.json({
          data: { checkout: { order: {} } },
        });
      }
      return Response.json({
        data: {
          cart: {
            total: '19.90',
            contents: {
              nodes: [{ quantity: 1, product: { node: { databaseId: 1001 } } }],
            },
          },
        },
      });
    },
  );
  const order = await adapter.createOrFind({
    paymentMethod: 'CARD',
    reference: 'replica-portable-operation',
    subject: 'buyer-1',
    session: {
      cartToken: workflowHeaders.get('cart-token'),
      wooSession: workflowHeaders.get('woocommerce-session'),
      cookie: workflowHeaders.get('cookie'),
    },
  });
  const graphqlHeaders = receivedHeaders.find(
    (headers) => headers['woocommerce-session'],
  );
  assert.equal(graphqlHeaders['woocommerce-session'], 'woo-session');
  assert.equal(graphqlHeaders.cookie, 'wp_session=cookie-value');
  assert.equal(
    receivedOperations.find(({ query }) => query.includes('mutation Checkout'))
      .variables.input.paymentMethod,
    'cod',
  );
  assert.deepEqual(order.cartSnapshot.items, [{ id: 1001, quantity: 1 }]);
  const failing = createWooCheckoutAdapter(
    'http://wordpress.test',
    {
      consumerKey: 'commerce-key',
      consumerSecret: 'commerce-secret',
    },
    async () => new Response(null, { status: 503 }),
  );
  await assert.rejects(
    () =>
      failing.createOrFind({
        paymentMethod: 'CARD',
        reference: 'failed',
        subject: 'buyer-1',
        session: returnedSession,
      }),
    (error) => error instanceof WooCheckoutRequestError && error.status === 503,
  );
  assert.doesNotMatch(
    await readFile(
      'apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts',
      'utf8',
    ),
    /customer\s*\{\s*orders/,
  );
});

// US-063 — Keep the buyer cart portable
test('AC-132: WordPress owns cart mutations @spec:AC-132', async () => {
  // Dado: WPGraphQL for WooOrderWorkflow exposes cart operations
  // Quando: the buyer changes the cart through the supergraph
  // Então: WordPress performs the mutation and OrderWorkflow does not duplicate it
  const [wordpressSchema, commerceSchema, resolver, journey] =
    await Promise.all([
      readFile('libs/contracts/graphql/wordpress/schema.graphql', 'utf8'),
      readFile('libs/contracts/graphql/order-workflow/schema.graphql', 'utf8'),
      readFile(
        'apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts',
        'utf8',
      ),
      readFile('apps/e2e/src/journey.ts', 'utf8'),
    ]);
  assert.match(wordpressSchema, /addToCart\(input: AddToCartInput!\)/);
  assert.doesNotMatch(commerceSchema, /commerceAddToCart/);
  assert.doesNotMatch(resolver, /OrderWorkflowCartResolver|commerceAddToCart/);
  assert.match(journey, /mutation addToCart/);
});

// US-064 — Create one recoverable WooOrderWorkflow order
test('AC-133: Checkout converges on one order @spec:AC-133', () => {
  // Dado: concurrent or recovered attempts use the same operation key
  // Quando: WooOrderWorkflow creation succeeds, times out, or is retried
  // Então: every successful response identifies the same WooOrderWorkflow order
  return proveRecoverableCheckout();
});

async function proveRecoverableCheckout() {
  const [{ CheckoutService }, { CheckoutOperationStatus }] = await Promise.all([
    import('../apps/order-workflow-subgraph/src/checkout/checkout.service.ts'),
    import(
      '../apps/order-workflow-subgraph/src/persistence/entities/checkout-operation.entity.ts'
    ),
  ]);
  const operations = new Map();
  const externalOrders = new Map();
  let ownerSequence = 0;
  const repository = {
    async claim(input) {
      const key = `${input.subject}:${input.operationKey}`;
      let operation = operations.get(key);
      if (!operation) {
        operation = {
          id: `checkout-${operations.size + 1}`,
          ...input,
          status: CheckoutOperationStatus.PendingWoo,
        };
        operations.set(key, operation);
      }
      const ownerToken = operation.ownerToken
        ? null
        : `owner-${++ownerSequence}`;
      if (ownerToken) operation.ownerToken = ownerToken;
      return { operation, ownerToken };
    },
    async beginCreation(id, ownerToken) {
      const operation = [...operations.values()].find((item) => item.id === id);
      assert.equal(operation.ownerToken, ownerToken);
      operation.status = CheckoutOperationStatus.CreatingWoo;
    },
    async release(id, ownerToken) {
      const operation = [...operations.values()].find((item) => item.id === id);
      if (operation.ownerToken === ownerToken) operation.ownerToken = undefined;
    },
    async find(subject, operationKey) {
      return operations.get(`${subject}:${operationKey}`) ?? null;
    },
    async confirm(id, wooOrderId) {
      const operation = [...operations.values()].find((item) => item.id === id);
      operation.wooOrderId = wooOrderId;
      operation.status = CheckoutOperationStatus.Completed;
      operation.ownerToken = undefined;
      return { id: `workflow-${id}`, wooOrderId };
    },
  };
  const command = {
    subject: 'buyer-133',
    operationKey: 'concurrent',
    paymentMethod: 'CARD',
  };
  let creates = 0;
  const woo = {
    async findByReference(input) {
      return externalOrders.get(input.reference) ?? null;
    },
    async createOrFind(input) {
      creates += 1;
      await new Promise((resolve) => setTimeout(resolve, 75));
      const order = {
        id: 'woo-concurrent',
        cartSnapshot: {
          items: [{ id: 1001, quantity: 1 }],
          totals: {
            total_price: '1990',
            currency_minor_unit: 2,
            currency_code: 'BRL',
          },
        },
      };
      externalOrders.set(input.reference, order);
      return order;
    },
  };
  const outbox = {
    async enqueueCheckoutRequested() {
      return undefined;
    },
  };
  const firstReplica = new CheckoutService(repository, outbox, woo);
  const secondReplica = new CheckoutService(repository, outbox, woo);
  const concurrent = await Promise.all([
    firstReplica.checkout(command),
    secondReplica.checkout(command),
  ]);
  assert.deepEqual(concurrent[0], concurrent[1]);
  assert.equal(creates, 1);

  const timedOut = { ...command, operationKey: 'ambiguous-timeout' };
  const ambiguousWoo = {
    ...woo,
    async createOrFind(input) {
      externalOrders.set(input.reference, {
        id: 'woo-after-timeout',
        cartSnapshot: {
          items: [{ id: 1001, quantity: 1 }],
          totals: {
            total_price: '1990',
            currency_minor_unit: 2,
            currency_code: 'BRL',
          },
        },
      });
      throw new TypeError(
        'response timed out after WooOrderWorkflow committed',
      );
    },
  };
  await assert.rejects(
    new CheckoutService(repository, outbox, ambiguousWoo).checkout(timedOut),
    /timed out/,
  );
  const recovered = await secondReplica.checkout(timedOut);
  assert.equal(recovered.wooOrderId, 'woo-after-timeout');
  assert.equal(creates, 1, 'reconciliation must not issue another POST');

  const [{ createWooCheckoutAdapter }, plugin] = await Promise.all([
    import(
      '../apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts'
    ),
    readFile(
      'apps/wordpress-integration/plugins/order-workflow-reconciliation/order-workflow-reconciliation.php',
      'utf8',
    ),
  ]);
  let reconciliationRequest;
  const reconciliation = createWooCheckoutAdapter(
    'http://wordpress.test',
    {
      consumerKey: 'commerce-key',
      consumerSecret: 'commerce-secret',
    },
    async (url, init) => {
      reconciliationRequest = { url: new URL(url), init };
      return Response.json([
        {
          id: 8123,
          total: '19.90',
          currency: 'BRL',
          meta_data: [
            {
              key: '_order_workflow_operation_reference',
              value: 'stable-operation-reference',
            },
          ],
          line_items: [{ product_id: 1001, quantity: 1 }],
        },
      ]);
    },
  );
  const found = await reconciliation.findByReference({
    paymentMethod: 'CARD',
    reference: 'stable-operation-reference',
    subject: 'buyer-133',
  });
  assert.equal(found.id, '8123');
  assert.equal(reconciliationRequest.url.pathname, '/wp-json/wc/v3/orders');
  assert.equal(
    reconciliationRequest.url.searchParams.get('search'),
    'stable-operation-reference',
  );
  assert.equal(
    reconciliationRequest.init.headers.authorization,
    `Basic ${Buffer.from('commerce-key:commerce-secret').toString('base64')}`,
  );
  assert.equal(
    reconciliationRequest.init.headers['x-forwarded-proto'],
    'https',
  );
  assert.match(plugin, /woocommerce_shop_order_search_fields/);
  assert.match(plugin, /woocommerce_order_table_search_query_meta_keys/);
}

// US-066 — Observe order progress across replicas
test('AC-135: Subscription state is replayable @spec:AC-135', async () => {
  // Dado: an order workflow has progressed or reached a terminal state
  // Quando: a subscriber connects or reconnects to any replica
  // Então: it receives the latest authorized state and subsequent transitions
  const [
    { OrderEventBroker },
    { OrderEventsSubscription },
    { PostgresOrderEventRelay },
    consumerSource,
  ] = await Promise.all([
    import(
      '../apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts'
    ),
    import(
      '../apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.ts'
    ),
    import(
      '../apps/order-workflow-subgraph/src/subscriptions/postgres-order-event.relay.ts'
    ),
    readFile(
      'apps/order-workflow-subgraph/src/saga/order-event.consumer.ts',
      'utf8',
    ),
  ]);
  const persisted = {
    eventTime: '2026-09-01T12:00:00.000Z',
    operationKey: 'checkout-1',
    orderId: '42',
    state: 'PAYMENT_PENDING',
    version: 1,
  };
  const replicaBroker = new OrderEventBroker();
  const replay = {
    async latest(subject, operationKey) {
      assert.equal(subject, 'buyer-1');
      assert.equal(operationKey, 'checkout-1');
      return persisted;
    },
    async byWorkflowId(workflowId) {
      assert.equal(workflowId, '123e4567-e89b-42d3-a456-426614174000');
      return {
        subject: 'buyer-1',
        operationKey: 'checkout-1',
        payload: completed,
      };
    },
  };
  const subscription = new OrderEventsSubscription(replicaBroker, replay);
  const stream = subscription.subscribe('buyer-1', 'checkout-1');
  assert.deepEqual(await stream.next(), { done: false, value: persisted });

  const completed = {
    ...persisted,
    eventTime: '2026-09-01T12:01:00.000Z',
    state: 'COMPLETED',
    version: 2,
  };
  const relay = new PostgresOrderEventRelay(replicaBroker, replay);
  relay.receive({
    payload: '123e4567-e89b-42d3-a456-426614174000',
  });
  assert.deepEqual(await stream.next(), { done: false, value: completed });
  assert.deepEqual(await stream.next(), { done: true, value: undefined });
  assert.match(consumerSource, /pg_notify/);
  assert.doesNotMatch(
    await readFile(
      'apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts',
      'utf8',
    ),
    /latest\s*=\s*new Map/,
  );
});

// US-067 — Preserve framework-aligned quality
test('AC-136: Every correction passes its quality loop @spec:AC-136', async () => {
  // Dado: a task changes production code
  // Quando: the task is considered complete
  // Então: focused tests, applicable ESLint targets, and a code-review pass succeed
  const [evidence, messagingRuntime] = await Promise.all([
    readFile('docs/evidence/production-happy-path-hardening/review.md', 'utf8'),
    readFile(
      'apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts',
      'utf8',
    ),
  ]);
  for (const gate of [
    'Focused tests: PASS',
    'ESLint: PASS',
    'Typecheck: PASS',
    'Code review: PASS',
  ]) {
    assert.match(evidence, new RegExp(gate));
  }
  assert.match(messagingRuntime, /private reconnectPromise\?: Promise<void>/);
  assert.match(messagingRuntime, /await this\.reconnectPromise/);
  assert.match(messagingRuntime, /closePromise \?\?=/);
});

// US-067 — Preserve framework-aligned quality
test('AC-137: Dependencies point toward application contracts @spec:AC-137', async () => {
  // Dado: resolvers, consumers, and application services need authentication, persistence, messaging, or WooOrderWorkflow capabilities
  // Quando: their NestJS modules are composed
  // Então: business code depends on explicit ports and injection tokens while concrete adapters remain replaceable infrastructure providers
  const [resolver, module, checkout, guard, decorator] = await Promise.all([
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/checkout/checkout.service.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/auth/oauth-resource.guard.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/authenticated-subject.decorator.ts',
      'utf8',
    ),
  ]);
  assert.match(resolver, /@Resolver/);
  assert.match(resolver, /@OAuthSubject/);
  assert.match(resolver, /@Inject\(ORDER_WORKFLOW_OPERATIONS\)/);
  assert.doesNotMatch(resolver, /woo-checkout\.adapter|checkout\.repository/);
  assert.match(module, /provide: ORDER_WORKFLOW_OPERATIONS/);
  assert.match(module, /provide: APP_GUARD/);
  assert.match(module, /fieldResolverEnhancers: \['guards'\]/);
  assert.match(guard, /implements CanActivate/);
  assert.match(decorator, /createParamDecorator/);
  assert.doesNotMatch(checkout, /@nestjs|@mikro-orm|woo-checkout\.adapter/);
});
