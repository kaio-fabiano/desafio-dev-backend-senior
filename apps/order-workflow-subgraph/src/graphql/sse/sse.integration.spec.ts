import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type Client } from 'graphql-sse';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OAuthCredentialError,
  OAuthResourceService,
} from '@desafio-dev-backend-senior/source/platform-nest';
import { AppModule } from '../../app.module.ts';
import {
  ORDER_WORKFLOW_OPERATIONS,
  type OrderWorkflowOperations,
} from '../order-workflow.resolver.ts';
import { WOO_CHECKOUT } from '../../checkout/checkout.tokens.ts';
import { ORDER_WORKFLOW_ORM } from '../../persistence/persistence.tokens.ts';
import { OrderWorkflowRuntimeLifecycle } from '../../messaging/order-workflow-messaging.runtime.ts';
import { OrderEventBroker } from '../../order-events/order-event-broker.ts';
import { OrderEventsSubscription } from '../../order-events/order-events.subscription.ts';
import { PostgresOrderEventRelay } from '../../order-events/postgres/postgres-order-event.relay.ts';

describe('Order workflow GraphQL SSE boundary', () => {
  const applications: Array<Awaited<ReturnType<typeof createApplication>>> = [];

  afterEach(async () => {
    await Promise.allSettled(
      applications.splice(0).map(({ app, client }) => {
        client.dispose();
        return app.close();
      }),
    );
  });

  it('serves the authenticated owner stream and releases it during shutdown @spec:AC-201 @spec:AC-231', async () => {
    const running = await createApplication();
    applications.push(running);
    const stream = running.client.iterate({
      query: `subscription Events($operationKey: ID!) {
        orderEvents(operationKey: $operationKey) {
          operationKey
          orderId
          state
          eventTime
        }
      }`,
      variables: { operationKey: 'operation-231' },
    });
    const next = stream.next();

    await vi.waitFor(() => {
      expect(running.broker.listenerCount('buyer-231', 'operation-231')).toBe(
        1,
      );
    });
    expect(running.broker.listenerCount('another-buyer', 'operation-231')).toBe(
      0,
    );
    running.broker.publish({
      subject: 'buyer-231',
      operationKey: 'operation-231',
      payload: {
        operationKey: 'operation-231',
        orderId: '731',
        state: 'PAYMENT_PENDING',
        eventTime: new Date(0).toISOString(),
        version: 1,
      },
    });

    await expect(next).resolves.toEqual({
      done: false,
      value: {
        data: {
          orderEvents: {
            eventTime: new Date(0).toISOString(),
            operationKey: 'operation-231',
            orderId: '731',
            state: 'PAYMENT_PENDING',
          },
        },
      },
    });

    await running.app.close();
    applications.splice(applications.indexOf(running), 1);
    expect(running.broker.listenerCount()).toBe(0);
  });

  it('releases the owner stream when the HTTP client disconnects @spec:AC-231', async () => {
    const running = await createApplication();
    applications.push(running);
    const stream = running.client.iterate(
      subscriptionRequest('disconnect-231'),
    );
    const next = stream.next();
    await vi.waitFor(() => {
      expect(running.broker.listenerCount('buyer-231', 'disconnect-231')).toBe(
        1,
      );
    });

    running.client.dispose();
    await vi.waitFor(() => expect(running.broker.listenerCount()).toBe(0));
    await Promise.allSettled([next]);
  });

  it('enforces subscription authentication and scopes before opening an owner stream @spec:AC-231', async () => {
    const running = await createApplication();
    applications.push(running);
    const denied = sseClient(running.url, 'Bearer denied');
    const deniedStream = denied.iterate(subscriptionRequest('denied-231'));

    const deniedResult = await deniedStream.next();
    expect(deniedResult.value).toMatchObject({
      errors: [{ message: 'Required OAuth scope is missing' }],
    });
    expect(running.broker.listenerCount()).toBe(0);
    const closeDeniedStream = deniedStream.return;
    if (!closeDeniedStream) throw new Error('SSE iterator cannot be closed');
    await closeDeniedStream.call(deniedStream, undefined);
    denied.dispose();

    const unauthenticated = await fetch(running.url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(subscriptionRequest('unauthenticated-231')),
    });
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      errors: [{ message: 'Unauthorized' }],
    });

    const invalid = await fetch(running.url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer invalid',
        'content-type': 'application/json',
      },
      body: JSON.stringify(subscriptionRequest('invalid-231')),
    });
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toEqual({
      errors: [{ message: 'Unauthorized' }],
    });

    const unavailable = await fetch(running.url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer unavailable',
        'content-type': 'application/json',
      },
      body: JSON.stringify(subscriptionRequest('unavailable-231')),
    });
    expect(unavailable.status).toBe(500);
    expect(await unavailable.text()).not.toContain('JWKS signing keys leaked');
    expect(running.broker.listenerCount()).toBe(0);
  });

  it('enforces mutation scope and forwards the verified owner with checkout session data @spec:AC-231', async () => {
    const running = await createApplication();
    applications.push(running);
    const body = {
      query: `mutation Checkout($input: OrderWorkflowCheckoutInput!) {
        startCheckout(input: $input) { id wooOrderId paymentMethod pixCode }
      }`,
      variables: {
        input: {
          operationKey: 'checkout-231',
          paymentMethod: 'CARD',
          payerEmail: 'buyer@example.test',
          providerToken: 'provider-token',
          paymentMethodId: 'visa',
        },
      },
    };
    const allowed = await graphql(running.url, body, 'Bearer checkout', {
      cookie: 'wp_woocommerce_session=owner-session',
      'cart-token': 'cart-231',
      'woocommerce-session': 'woo-231',
    });

    expect(allowed).toEqual({
      data: {
        startCheckout: {
          id: 'order-node-731',
          paymentMethod: 'CARD',
          pixCode: null,
          wooOrderId: '731',
        },
      },
    });
    expect(running.operations.checkout).toHaveBeenCalledWith(
      'buyer-231',
      body.variables.input,
      {
        cartToken: 'cart-231',
        cookie: 'wp_woocommerce_session=owner-session',
        wooSession: 'woo-231',
      },
    );

    const denied = await graphql(running.url, body, 'Bearer stream');
    expect(denied.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(running.operations.checkout).toHaveBeenCalledOnce();
  });
});

function subscriptionRequest(operationKey: string) {
  return {
    query: `subscription Events($operationKey: ID!) {
      orderEvents(operationKey: $operationKey) { operationKey orderId state eventTime }
    }`,
    variables: { operationKey },
  };
}

function sseClient(url: string, authorization: string): Client {
  return createClient({
    url,
    headers: { authorization },
    retryAttempts: 0,
    singleConnection: false,
  });
}

async function graphql(
  streamUrl: string,
  body: unknown,
  authorization: string,
  headers: Record<string, string> = {},
): Promise<GraphqlHttpResponse> {
  const response = await fetch(streamUrl.replace('/stream', ''), {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<GraphqlHttpResponse>;
}

interface GraphqlHttpResponse {
  data?: Record<string, unknown>;
  errors: Array<{ extensions: { code?: string }; message: string }>;
}

async function createApplication() {
  const broker = new OrderEventBroker();
  const subscriptions = new OrderEventsSubscription(
    broker,
    { latest: async () => null },
    { heartbeatMs: 60_000, idleTimeoutMs: 60_000, maxBufferedEvents: 4 },
  );
  const operations = {
    checkout: vi.fn().mockResolvedValue({
      __typename: 'Order',
      id: 'order-node-731',
      paymentMethod: 'CARD',
      pixCode: undefined,
      wooOrderId: '731',
      workflow: { state: 'CREATED' },
    }),
    findCheckout: vi.fn(),
    findWorkflow: vi.fn(),
  } satisfies OrderWorkflowOperations;
  const orm = {
    checkConnection: async () => ({ ok: true as const }),
    em: { fork: () => ({}) },
  };
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue({ get: (_name: string, fallback: string) => fallback })
    .overrideProvider(OAuthResourceService)
    .useValue({
      verify: async (request: Request) => {
        const authorization = request.headers.get('authorization');
        if (!authorization || authorization === 'Bearer invalid') {
          throw new OAuthCredentialError('Invalid bearer credential');
        }
        if (authorization === 'Bearer unavailable') {
          throw new Error('JWKS signing keys leaked');
        }
        return {
          audience: ['https://order-workflow.marketplace.local'],
          claims: {},
          scopes:
            authorization === 'Bearer checkout'
              ? ['cart:write']
              : authorization === 'Bearer stream'
                ? ['orders:read']
                : [],
          subject: 'buyer-231',
        };
      },
    })
    .overrideProvider(ORDER_WORKFLOW_ORM)
    .useValue(orm)
    .overrideProvider(WOO_CHECKOUT)
    .useValue({})
    .overrideProvider(ORDER_WORKFLOW_OPERATIONS)
    .useValue(operations)
    .overrideProvider(OrderEventBroker)
    .useValue(broker)
    .overrideProvider(OrderEventsSubscription)
    .useValue(subscriptions)
    .overrideProvider(PostgresOrderEventRelay)
    .useValue({ connected: true })
    .overrideProvider(OrderWorkflowRuntimeLifecycle)
    .useValue({ connected: true })
    .compile();
  const app = testingModule.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') {
    throw new Error('Order workflow test application did not bind');
  }
  return {
    app,
    broker,
    client: sseClient(
      `http://127.0.0.1:${address.port}/graphql/stream`,
      'Bearer stream',
    ),
    operations,
    url: `http://127.0.0.1:${address.port}/graphql/stream`,
  };
}
