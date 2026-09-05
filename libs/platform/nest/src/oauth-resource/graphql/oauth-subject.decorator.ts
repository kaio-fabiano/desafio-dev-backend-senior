import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { OAuthGraphQLContext } from '../oauth-resource.types.ts';
import { OAUTH_AUTHENTICATION_MESSAGES } from '../verification/oauth-resource.errors.ts';

function oauthSubjectFactory(
  _data: unknown,
  executionContext: ExecutionContext,
): string {
  const context =
    GqlExecutionContext.create(
      executionContext,
    ).getContext<OAuthGraphQLContext>();
  if (!context.auth?.subject) {
    throw new UnauthorizedException(
      OAUTH_AUTHENTICATION_MESSAGES.authenticatedSubjectRequired,
    );
  }
  return context.auth.subject;
}

export const OAuthSubject = createParamDecorator(oauthSubjectFactory);
