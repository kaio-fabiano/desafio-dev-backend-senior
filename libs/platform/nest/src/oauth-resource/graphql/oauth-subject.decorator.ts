import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { OAuthAuthenticationMessages } from '../presentation/graphql/oauth-authentication-messages.ts';
import type { OAuthGraphQLContext } from '../presentation/graphql/oauth-graphql-context.ts';

export const OAuthSubject = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): string => {
    const context =
      GqlExecutionContext.create(
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
