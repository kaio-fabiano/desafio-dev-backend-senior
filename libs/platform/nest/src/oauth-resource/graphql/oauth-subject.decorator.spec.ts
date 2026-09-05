import { type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';

import type { OAuthGraphQLContext } from '../oauth-resource.types.ts';
import { OAuthSubject } from './oauth-subject.decorator.ts';

function graphqlExecution(context: object): ExecutionContextHost {
  const execution = new ExecutionContextHost([{}, {}, context, {}]);
  execution.setType('graphql');
  return execution;
}

function subjectFactory(): (
  data: unknown,
  context: ExecutionContext,
) => unknown {
  class Resolver {
    operation(subject: string): boolean {
      return subject.length > 0;
    }
  }
  OAuthSubject()(Resolver.prototype, 'operation', 0);
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Resolver,
    'operation',
  ) as Record<
    string,
    { factory: (data: unknown, context: ExecutionContext) => unknown }
  >;
  return Object.values(metadata)[0].factory;
}

describe('OAuthSubject', () => {
  it('AC-221: resolves the authenticated subject through NestJS decorator metadata @spec:AC-221', () => {
    const context = {
      auth: {
        audience: ['resource'],
        claims: {},
        scopes: [],
        subject: 'buyer-1',
      },
    } satisfies OAuthGraphQLContext;

    expect(subjectFactory()(undefined, graphqlExecution(context))).toBe(
      'buyer-1',
    );
  });

  it('rejects a GraphQL context without an authenticated subject', () => {
    expect(() => subjectFactory()(undefined, graphqlExecution({}))).toThrow(
      'Authenticated subject is required',
    );
  });
});
