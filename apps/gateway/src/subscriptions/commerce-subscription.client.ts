import type { ExecutionResult } from 'graphql';
import {
  createClient,
  type Client,
  type ClientOptions,
  type RequestParams,
} from 'graphql-sse';

import type { AuthContext } from '@desafio-dev-backend-senior/source/gateway-nest';

type DelegatedClient = Pick<Client, 'dispose' | 'iterate'>;

export type CommerceSubscriptionClient = {
  subscribe(
    request: RequestParams,
    context: AuthContext,
  ): AsyncGenerator<ExecutionResult>;
};

type CommerceSubscriptionClientOptions = {
  url: string;
  internalSecret?: string;
  createClient?: (options: ClientOptions<false>) => DelegatedClient;
};

export function createCommerceSubscriptionClient({
  url,
  internalSecret = process.env.FEDERATION_INTERNAL_SECRET ?? '',
  createClient: makeClient = createClient,
}: CommerceSubscriptionClientOptions): CommerceSubscriptionClient {
  return {
    subscribe(request, context) {
      const client = makeClient({
        url,
        singleConnection: false,
        retryAttempts: 0,
        headers: {
          'x-federation-secret': internalSecret,
          'x-authenticated-subject': context.subject,
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
