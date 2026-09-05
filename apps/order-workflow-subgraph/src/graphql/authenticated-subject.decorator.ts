import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { WooCheckoutSession } from '../checkout/woo-checkout.port.ts';

export type OrderWorkflowSessionContext = WooCheckoutSession;

export const OrderWorkflowSession = createParamDecorator(
  (_: unknown, context: ExecutionContext): OrderWorkflowSessionContext => {
    const auth =
      GqlExecutionContext.create(
        context,
      ).getContext<OrderWorkflowSessionContext>();
    return {
      cartToken: auth.cartToken,
      wooSession: auth.wooSession,
      cookie: auth.cookie,
    };
  },
);
