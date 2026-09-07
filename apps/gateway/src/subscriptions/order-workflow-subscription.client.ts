import type { ExecutionResult } from 'graphql';
import {
  createClient,
  type Client,
  type ClientOptions,
  type RequestParams,
} from 'graphql-sse';

import type { GatewayContext } from '@desafio-dev-backend-senior/source/gateway-nest';

export class OrderWorkflowSubscriptionClient {
  constructor(
    private readonly url: string,
    private readonly makeClient: (options: ClientOptions<false>) => Pick<Client, 'dispose' | 'iterate'> = createClient,
  ) {}

  subscribe(request: RequestParams, context: GatewayContext): AsyncGenerator<ExecutionResult> {
    const client = this.makeClient({
        url: this.url,
        singleConnection: false,
        retryAttempts: 0,
        headers: {
          authorization: context.authorization,
          'x-request-id': context.requestId,
        },
    });
    const downstream = client.iterate(request);
    return this.delegate(downstream, client);
  }

  private async *delegate(downstream: ReturnType<Client['iterate']>, client: Pick<Client, 'dispose'>): AsyncGenerator<ExecutionResult> {
    try { yield* downstream as AsyncIterableIterator<ExecutionResult>; } finally { client.dispose(); }
  }
}
