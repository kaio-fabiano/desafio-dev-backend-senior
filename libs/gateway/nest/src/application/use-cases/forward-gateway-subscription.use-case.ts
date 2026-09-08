import { Inject, Injectable } from '@nestjs/common';

import type { GatewayContext } from '../dto/gateway-context.dto.ts';
import { OrderWorkflowSubscriptionPort } from '../ports/order-workflow-subscription.port.ts';

@Injectable()
export class ForwardGatewaySubscriptionUseCase {
  constructor(
    @Inject(OrderWorkflowSubscriptionPort)
    private readonly subscriptions: OrderWorkflowSubscriptionPort,
  ) {}

  execute(request: unknown, context: GatewayContext): AsyncGenerator<unknown> {
    return this.subscriptions.subscribe(request, context);
  }
}
