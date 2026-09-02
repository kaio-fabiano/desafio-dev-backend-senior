import type { ExecutionResult } from 'graphql';
import {
  createClient,
  type Client,
  type ClientOptions,
  type RequestParams,
} from 'graphql-sse';

import type { AuthContext } from '@desafio-dev-backend-senior/source/gateway-nest';

type DelegatedClient = Pick<Client, 'dispose' | 'iterate'>;

export type OrderWorkflowSubscriptionClient = {
  subscribe(
    request: RequestParams,
    context: AuthContext,
  ): AsyncGenerator<ExecutionResult>;
};

type OrderWorkflowSubscriptionClientOptions = {
  url: string;
  createClient?: (options: ClientOptions<false>) => DelegatedClient;
};

export function createOrderWorkflowSubscriptionClient({
  url,
  createClient: makeClient = createClient,
}: OrderWorkflowSubscriptionClientOptions): OrderWorkflowSubscriptionClient {
  return {
    subscribe(request, context) {
      const client = makeClient({
        url,
        singleConnection: false,
        retryAttempts: 0,
        headers: {
          authorization: context.authorization,
          'x-request-id': context.requestId,
        },
      });
      const downstream = client.iterate(request);
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        client.dispose();
      };

      return (async function* delegate() {
        try {
          yield* downstream as AsyncIterableIterator<ExecutionResult>;
        } finally {
          dispose();
        }
      })();
    },
  };
}
