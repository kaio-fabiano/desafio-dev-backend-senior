import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export type OrderWorkflowAuthContext = {
  subject: string;
  cartToken?: string;
  wooSession?: string;
  cookie?: string;
};

export const AuthenticatedSubject = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const subject = GqlExecutionContext.create(context)
      .getContext<OrderWorkflowAuthContext>()
      .subject?.trim();
    if (!subject) throw new Error('Authenticated subject is required');
    return subject;
  },
);

export const OrderWorkflowSession = createParamDecorator(
  (
    _: unknown,
    context: ExecutionContext,
  ): Omit<OrderWorkflowAuthContext, 'subject'> => {
    const auth =
      GqlExecutionContext.create(
        context,
      ).getContext<OrderWorkflowAuthContext>();
    return {
      cartToken: auth.cartToken,
      wooSession: auth.wooSession,
      cookie: auth.cookie,
    };
  },
);
