import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import type { AuthContext } from '../auth/auth-context.factory.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<AuthContext> {
  private readonly origin?: string;
  private readonly capturesSession: boolean;
  private readonly forwardsBearer: boolean;
  private readonly forwardsSession: boolean;

  constructor(config: {
    url: string;
    kind?: 'wordpress' | 'order-workflow' | 'other';
  }) {
    super({ url: config.url });
    const kind = config.kind ?? 'other';
    this.capturesSession = kind === 'wordpress';
    this.forwardsBearer = kind !== 'wordpress';
    this.forwardsSession = kind === 'wordpress' || kind === 'order-workflow';
    this.origin = kind === 'wordpress' ? new URL(config.url).origin : undefined;
  }

  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<AuthContext>) {
    if (this.origin) request.http?.headers.set('origin', this.origin);
    if (!context || !('subject' in context) || !context.subject) return;

    if (this.forwardsBearer) {
      request.http?.headers.set('authorization', context.authorization);
    }
    request.http?.headers.set('x-request-id', context.requestId);
    if (this.forwardsSession) {
      for (const name of [
        'cookie',
        'woocommerce-session',
        'cart-token',
      ] as const) {
        const value = context.sessionHeaders?.[name];
        if (typeof value === 'string') request.http?.headers.set(name, value);
      }
    }
  }

  override didReceiveResponse({
    response,
    context,
  }: Parameters<
    NonNullable<RemoteGraphQLDataSource<AuthContext>['didReceiveResponse']>
  >[0]): ReturnType<
    NonNullable<RemoteGraphQLDataSource<AuthContext>['didReceiveResponse']>
  > {
    if (!this.capturesSession) return response;
    for (const name of ['woocommerce-session', 'cart-token']) {
      const value = response.http?.headers.get(name);
      if (typeof value === 'string' && value) {
        context.setResponseHeader?.(name, value);
      }
    }
    const cookie = response.http?.headers.get('set-cookie');
    if (typeof cookie === 'string' && cookie) {
      context.setResponseHeader?.('set-cookie', cookie);
    }
    return response;
  }
}
