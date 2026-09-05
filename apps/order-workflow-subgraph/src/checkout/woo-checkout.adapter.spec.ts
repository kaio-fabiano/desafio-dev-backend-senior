import { describe, expect, it, vi } from 'vitest';

import {
  createWooCheckoutAdapter,
  WooCheckoutRequestError,
} from './woo-checkout.adapter.ts';

const serviceCredentials = {
  serviceIdentity: 'order-workflow',
  siteToken: 'site-token',
};

function authenticatedRequest(request: typeof fetch): typeof fetch {
  return async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string };
    return body.query.includes('mutation LoginOrderWorkflow')
      ? Response.json({ data: { login: { authToken: 'service-token' } } })
      : request(url, init);
  };
}

function orderResponse(nodes: unknown[]): Response {
  return Response.json({ data: { orders: { nodes } } });
}

describe('Woo checkout adapter', () => {
  it('coalesces concurrent creation and converts decimal totals exactly @spec:AC-229', async () => {
    let mutations = 0;
    const request = vi.fn<typeof fetch>(
      authenticatedRequest(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { query: string };
        if (body.query.includes('query FindOrderByWorkflowReference')) {
          return orderResponse([]);
        }
        if (body.query.includes('mutation Checkout')) {
          mutations += 1;
          return Response.json({
            data: { checkout: { order: { databaseId: 42 } } },
          });
        }
        return Response.json({
          data: {
            cart: {
              total: '0.29',
              contents: {
                nodes: [
                  { quantity: 2, product: { node: { databaseId: 1001 } } },
                ],
              },
            },
          },
        });
      }),
    );
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      request,
    );
    const input = {
      paymentMethod: 'CARD' as const,
      reference: 'operation-reference',
      subject: 'buyer-1',
      session: {
        cartToken: 'cart-token',
        wooSession: 'woo-session',
        cookie: 'wp_session=session',
      },
    };

    const [first, second] = await Promise.all([
      adapter.createOrFind(input),
      adapter.createOrFind(input),
    ]);

    expect(first).toEqual(second);
    expect(first.cartSnapshot).toEqual({
      items: [{ id: 1001, quantity: 2 }],
      totals: {
        total_price: '29',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    });
    expect(mutations).toBe(1);
  });

  it('finds and validates a WooCommerce order by its exact reference through GraphQL @spec:AC-229 @spec:AC-241 @spec:AC-243', async () => {
    let requestHeaders: RequestInit['headers'];
    const adapter = createWooCheckoutAdapter(
      'http://wordpress.test',
      serviceCredentials,
      authenticatedRequest(async (_url, init) => {
        requestHeaders = init?.headers;
        return orderResponse([
          {
            databaseId: 42,
            total: '19.90',
            currency: 'BRL',
            metaData: [
              {
                key: '_order_workflow_operation_reference',
                value: 'operation-reference',
              },
            ],
            lineItems: {
              nodes: [
                {
                  quantity: 1,
                  product: { node: { databaseId: 1001 } },
                },
              ],
            },
          },
        ]);
      }),
    );

    await expect(
      adapter.findByReference({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).resolves.toEqual({
      id: '42',
      cartSnapshot: {
        items: [{ id: 1001, quantity: 1 }],
        totals: {
          total_price: '1990',
          currency_minor_unit: 2,
          currency_code: 'BRL',
        },
      },
    });
    expect(requestHeaders).toMatchObject({
      authorization: 'Bearer service-token',
    });
  });

  it('rejects ambiguous, malformed, and failed order lookup responses @spec:AC-229', async () => {
    const order = {
      databaseId: 42,
      metaData: [
        {
          key: '_order_workflow_operation_reference',
          value: 'operation-reference',
        },
      ],
      lineItems: {
        nodes: [{ quantity: 1, product: { node: { databaseId: 1001 } } }],
      },
      total: '19.90',
      currency: 'BRL',
    };
    const input = {
      paymentMethod: 'PIX' as const,
      reference: 'operation-reference',
      subject: 'buyer-1',
    };
    const adapterFor = (response: Response) =>
      createWooCheckoutAdapter(
        'https://wordpress.test',
        serviceCredentials,
        authenticatedRequest(async () => response.clone()),
      );

    await expect(
      adapterFor(orderResponse([order, order])).findByReference(input),
    ).rejects.toThrow(/not unique/);
    await expect(
      adapterFor(
        Response.json({ data: { orders: { order } } }),
      ).findByReference(input),
    ).rejects.toThrow(/orders are invalid/);
    await expect(
      adapterFor(new Response(null, { status: 503 })).findByReference(input),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      adapterFor(orderResponse([null, { databaseId: '42' }])).findByReference(
        input,
      ),
    ).resolves.toBeNull();
  });

  it('rejects a service login without an auth token @spec:AC-241', async () => {
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      async () => Response.json({ data: { login: {} } }),
    );

    await expect(
      adapter.findByReference({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).rejects.toMatchObject({
      code: 'WOO_CHECKOUT_REQUEST_FAILED',
      status: 502,
    });
  });

  it('reconciles the order when checkout omits its id @spec:AC-229', async () => {
    let lookups = 0;
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      authenticatedRequest(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { query: string };
        if (body.query.includes('query FindOrderByWorkflowReference')) {
          lookups += 1;
          return orderResponse(
            lookups === 1
              ? []
              : [
                  {
                    databaseId: 42,
                    total: '19',
                    currency: 'BRL',
                    metaData: [
                      {
                        key: '_order_workflow_operation_reference',
                        value: 'operation-reference',
                      },
                    ],
                    lineItems: {
                      nodes: [
                        {
                          quantity: 1,
                          product: { node: { databaseId: 1001 } },
                        },
                      ],
                    },
                  },
                ],
          );
        }
        return body.query.includes('mutation Checkout')
          ? Response.json({ data: { checkout: { order: {} } } })
          : Response.json({
              data: {
                cart: {
                  total: '19.00',
                  contents: {
                    nodes: [
                      {
                        quantity: 1,
                        product: { node: { databaseId: 1001 } },
                      },
                    ],
                  },
                },
              },
            });
      }),
    );

    await expect(
      adapter.createOrFind({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).resolves.toMatchObject({ id: '42' });
    expect(lookups).toBe(2);
  });

  it('fails when checkout omits its id and reconciliation finds no order @spec:AC-229', async () => {
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      authenticatedRequest(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { query: string };
        if (body.query.includes('query FindOrderByWorkflowReference')) {
          return orderResponse([]);
        }
        return body.query.includes('mutation Checkout')
          ? Response.json({ data: { checkout: { order: {} } } })
          : Response.json({
              data: {
                cart: {
                  total: '19.00',
                  contents: {
                    nodes: [
                      {
                        quantity: 1,
                        product: { node: { databaseId: 1001 } },
                      },
                    ],
                  },
                },
              },
            });
      }),
    );

    await expect(
      adapter.createOrFind({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).rejects.toThrow('Checkout order is missing');
  });

  it.each([
    new Response(null, { status: 503 }),
    Response.json({ errors: [{ message: 'failed' }] }),
    Response.json({}),
    Response.json({ data: {} }),
    Response.json({ data: { cart: null } }),
    Response.json({ data: { cart: { total: '19.90' } } }),
  ])(
    'rejects invalid GraphQL cart responses %# @spec:AC-229',
    async (response) => {
      const adapter = createWooCheckoutAdapter(
        'https://wordpress.test',
        serviceCredentials,
        authenticatedRequest(async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { query: string };
          return body.query.includes('query FindOrderByWorkflowReference')
            ? orderResponse([])
            : response;
        }),
      );

      await expect(
        adapter.createOrFind({
          paymentMethod: 'PIX',
          reference: 'operation-reference',
          subject: 'buyer-1',
        }),
      ).rejects.toBeInstanceOf(WooCheckoutRequestError);
    },
  );

  it('rejects an order without valid cart lines @spec:AC-229', async () => {
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      authenticatedRequest(async () =>
        orderResponse([
          {
            databaseId: 42,
            total: '19.90',
            currency: 'BRL',
            metaData: [
              {
                key: '_order_workflow_operation_reference',
                value: 'operation-reference',
              },
            ],
            lineItems: { nodes: [] },
          },
        ]),
      ),
    );

    await expect(
      adapter.findByReference({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(WooCheckoutRequestError);
  });

  it.each([
    { databaseId: 0, total: '19.90', currency: 'BRL' },
    { databaseId: 42, total: '19.90', currency: 'brl' },
    { databaseId: 42, total: undefined, currency: 'BRL' },
  ])('rejects malformed stored order data %# @spec:AC-229', async (stored) => {
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      authenticatedRequest(async () =>
        orderResponse([
          {
            ...stored,
            metaData: [
              {
                key: '_order_workflow_operation_reference',
                value: 'operation-reference',
              },
            ],
            lineItems: {
              nodes: [
                {
                  quantity: 1,
                  product: { node: { databaseId: 1001 } },
                },
              ],
            },
          },
        ]),
      ),
    );

    await expect(
      adapter.findByReference({
        paymentMethod: 'PIX',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(WooCheckoutRequestError);
  });

  it('does not submit checkout when the cart amount exceeds BRL precision @spec:AC-229', async () => {
    let mutations = 0;
    const request = vi.fn<typeof fetch>(
      authenticatedRequest(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { query: string };
        if (body.query.includes('query FindOrderByWorkflowReference')) {
          return orderResponse([]);
        }
        if (body.query.includes('mutation Checkout')) {
          mutations += 1;
          return Response.json({
            data: { checkout: { order: { databaseId: 42 } } },
          });
        }
        return Response.json({
          data: {
            cart: {
              total: '19.999',
              contents: {
                nodes: [
                  { quantity: 1, product: { node: { databaseId: 1001 } } },
                ],
              },
            },
          },
        });
      }),
    );
    const adapter = createWooCheckoutAdapter(
      'https://wordpress.test',
      serviceCredentials,
      request,
    );

    await expect(
      adapter.createOrFind({
        paymentMethod: 'CARD',
        reference: 'operation-reference',
        subject: 'buyer-1',
      }),
    ).rejects.toBeInstanceOf(WooCheckoutRequestError);
    expect(mutations).toBe(0);
  });

  it.each([
    { total: '0.00', currency: 'BRL', id: 1001, quantity: 1 },
    { total: '90071992547409.92', currency: 'BRL', id: 1001, quantity: 1 },
    { total: '19.90', currency: 'BRL', id: 0, quantity: 1 },
    { total: '19.90', currency: 'BRL', id: 1001, quantity: 0 },
  ])(
    'rejects invalid cart data before checkout %# @spec:AC-229',
    async (cart) => {
      let mutations = 0;
      const adapter = createWooCheckoutAdapter(
        'https://wordpress.test',
        serviceCredentials,
        authenticatedRequest(async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { query: string };
          if (body.query.includes('query FindOrderByWorkflowReference')) {
            return orderResponse([]);
          }
          if (body.query.includes('mutation Checkout')) {
            mutations += 1;
            return Response.json({ data: {} });
          }
          return Response.json({
            data: {
              cart: {
                total: cart.total,
                contents: {
                  nodes: [
                    {
                      quantity: cart.quantity,
                      product: { node: { databaseId: cart.id } },
                    },
                  ],
                },
              },
            },
          });
        }),
      );

      await expect(
        adapter.createOrFind({
          paymentMethod: 'PIX',
          reference: 'operation-reference',
          subject: 'buyer-1',
        }),
      ).rejects.toBeInstanceOf(WooCheckoutRequestError);
      expect(mutations).toBe(0);
    },
  );
});
