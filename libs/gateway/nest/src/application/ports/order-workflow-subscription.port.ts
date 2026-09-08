import type { GatewayContext } from '../dto/gateway-context.dto.ts';

export abstract class OrderWorkflowSubscriptionPort {
  abstract subscribe(
    request: unknown,
    context: GatewayContext,
  ): AsyncGenerator<unknown>;
}
