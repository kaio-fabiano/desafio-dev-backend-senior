import type { GatewayContext } from '@desafio-dev-backend-senior/source/gateway-nest';
import type { IncomingMessage } from 'node:http';

import { OrderWorkflowSubscriptionClient } from './order-workflow-subscription.client.ts';
import { GatewaySseHandler } from './sse-handler.ts';

export class GatewaySseProvider {
  static create(
    verify: (request: IncomingMessage) => Promise<GatewayContext>,
  ): GatewaySseHandler {
    return new GatewaySseHandler({
      orderWorkflow: GatewaySseProvider.createOrderWorkflowSubscriptionClient(),
      verify,
    });
  }

  static createOrderWorkflowSubscriptionClient(): OrderWorkflowSubscriptionClient {
    return new OrderWorkflowSubscriptionClient(
      process.env.ORDER_WORKFLOW_SUBSCRIPTION_URL ??
        'http://order-workflow-subgraph:3003/graphql/stream',
    );
  }
}
