import type { GatewayContext } from '../dto/gateway-context.dto.ts';
import type { OrderWorkflowSubscriptionPort } from '../ports/order-workflow-subscription.port.ts';

export class ForwardGatewaySubscriptionUseCase {
  constructor(private readonly subscriptions: OrderWorkflowSubscriptionPort) {}

  execute(request: unknown, context: GatewayContext): AsyncGenerator<unknown> {
    return this.subscriptions.subscribe(request, context);
  }
}
