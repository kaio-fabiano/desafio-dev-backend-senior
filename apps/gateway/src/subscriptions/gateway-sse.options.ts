import type { IncomingMessage } from 'node:http';

import type { GatewayContext } from '@desafio-dev-backend-senior/source/gateway-nest';
import type { OrderWorkflowSubscriptionClient } from './order-workflow-subscription.client.ts';

export declare class GatewaySseOptions {
  readonly orderWorkflow: OrderWorkflowSubscriptionClient;
  readonly verify: (request: IncomingMessage) => Promise<GatewayContext>;
}
