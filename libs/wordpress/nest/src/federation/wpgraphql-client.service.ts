import type { IncomingHttpHeaders } from 'node:http';

import { WordPressCheckoutEventSource } from '../subscriptions/wordpress-checkout-event.source.ts';
import {
  WpGraphqlAuthorizationError,
  type WpGraphqlAuth,
  type WpGraphqlOperation,
} from './wpgraphql-auth.factory.ts';

export type WpGraphqlProxyRequest = {
  body?: unknown;
  headers: IncomingHttpHeaders;
};

export type WpGraphqlProxyResponse = {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  end(body?: Uint8Array | string): void;
};

export function normalizeWordPressSdl(sdl: string): string {
  const productKey = sdl.replace(
    /interface Product\b(?![^{]*@key)([^{]*){/,
    'interface Product$1@key(fields: "id") {',
  );
  const inaccessibleImport = productKey.includes('@inaccessible')
    ? productKey
    : productKey.replace(
        /(https:\/\/specs\.apollo\.dev\/federation\/v[\d.]+[\s\S]*?import\s*:\s*\[)([^\]]*)(\])/,
        '$1$2, "@inaccessible"$3',
      );
  return inaccessibleImport
    .replace(
      /(\bhasPreviousPage\s*:\s*Boolean!?)(?!\s*@inaccessible)/g,
      '$1 @inaccessible',
    )
    .replace(
      /(\bstartCursor\s*:\s*String)(?!\s*@inaccessible)/g,
      '$1 @inaccessible',
    );
}

function incomingHeaders(values: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(values)) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value !== undefined) headers.append(name, value);
    }
  }
  return headers;
}

function operationBody(body: unknown): WpGraphqlOperation {
  if (!body || typeof body !== 'object') {
    throw new Error('A GraphQL JSON body is required');
  }
  const candidate = body as Partial<WpGraphqlOperation>;
  if (typeof candidate.query !== 'string') {
    throw new Error('GraphQL query must be a string');
  }
  return candidate as WpGraphqlOperation;
}

export class WpGraphqlClientService {
  private readonly endpoint: string;
  private readonly auth: WpGraphqlAuth;
  private readonly request: typeof fetch;
  private readonly checkoutEvents?: WordPressCheckoutEventSource;

  constructor({
    endpoint,
    auth,
    request = fetch,
    checkoutEvents,
  }: {
    endpoint: string;
    auth: WpGraphqlAuth;
    request?: typeof fetch;
    checkoutEvents?: WordPressCheckoutEventSource;
  }) {
    this.endpoint = endpoint;
    this.auth = auth;
    this.request = request;
    this.checkoutEvents = checkoutEvents;
  }

  async execute(
    operation: WpGraphqlOperation,
    incoming = new Headers(),
  ): Promise<Response> {
    const headers = await this.auth.headersFor(operation, incoming);
    headers.set(
      'accept',
      'application/graphql-response+json, application/json',
    );
    headers.set('content-type', 'application/json');
    const response = await this.request(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(operation),
    });
    await this.checkoutEvents?.observe(
      operation,
      Object.fromEntries(incoming),
      response,
    );

    if (
      !/\b_service\b/.test(operation.query) ||
      !response.headers.get('content-type')?.includes('application/json')
    ) {
      return response;
    }
    const payload = (await response.json()) as {
      data?: { _service?: { sdl?: unknown } };
    };
    if (typeof payload.data?._service?.sdl === 'string') {
      payload.data._service.sdl = normalizeWordPressSdl(
        payload.data._service.sdl,
      );
    }
    const headersForNormalizedBody = new Headers(response.headers);
    for (const name of [
      'content-encoding',
      'content-length',
      'transfer-encoding',
    ]) {
      headersForNormalizedBody.delete(name);
    }
    return Response.json(payload, {
      status: response.status,
      headers: headersForNormalizedBody,
    });
  }

  async forward(
    request: WpGraphqlProxyRequest,
    response: WpGraphqlProxyResponse,
  ): Promise<void> {
    try {
      const upstream = await this.execute(
        operationBody(request.body),
        incomingHeaders(request.headers),
      );
      response.statusCode = upstream.status;
      upstream.headers.forEach((value, name) => {
        if (name !== 'set-cookie') response.setHeader(name, value);
      });
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length > 0) response.setHeader('set-cookie', cookies);
      response.end(new Uint8Array(await upstream.arrayBuffer()));
    } catch (error) {
      const forbidden = error instanceof WpGraphqlAuthorizationError;
      response.statusCode = forbidden ? 403 : 502;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          errors: [
            {
              message: forbidden
                ? error.message
                : 'WordPress GraphQL request failed',
            },
          ],
        }),
      );
    }
  }
}
