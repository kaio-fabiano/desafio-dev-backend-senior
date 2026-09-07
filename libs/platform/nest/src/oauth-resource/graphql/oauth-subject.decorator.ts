import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { OAuthGraphQLContext } from '../oauth-graphql-context.ts';
import { OAuthAuthenticationMessages } from '../verification/oauth-authentication-messages.ts';

export const OAuthSubject = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): string => {
    const context = GqlExecutionContext.create(
      executionContext,
    ).getContext<OAuthGraphQLContext>();
    if (!context.auth?.subject) {
      throw new UnauthorizedException(
        OAuthAuthenticationMessages.authenticatedSubjectRequired,
      );
    }
    return context.auth.subject;
  },
);
