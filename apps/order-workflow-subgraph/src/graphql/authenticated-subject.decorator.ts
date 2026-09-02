import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export type OrderWorkflowSessionContext = {
  cartToken?: string;
  wooSession?: string;
  cookie?: string;
};

export const OrderWorkflowSession = createParamDecorator(
  (
    _: unknown,
    context: ExecutionContext,
  ): OrderWorkflowSessionContext => {
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
