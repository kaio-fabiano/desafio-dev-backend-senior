import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import { CommerceCookiePolicy } from '../auth/commerce-cookie-policy.ts';
import { CommerceSessionRequestHeaders } from '../auth/commerce-session-request-headers.ts';
import { CommerceSessionResponseHeaders } from '../auth/commerce-session-response-headers.ts';
import type { GatewayContext } from '../auth/gateway-context.ts';
import type { FederationCapabilities } from './federation-capabilities.ts';
import { SetCookieValues } from './set-cookie-values.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<GatewayContext> {
  private readonly capabilities: FederationCapabilities;

  constructor(config: { url: string; capabilities?: FederationCapabilities }) {
    super({ url: config.url });
    this.capabilities = { ...config.capabilities };
  }

  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<GatewayContext>) {
    const headers = request.http?.headers;
    if (!headers) return;
    if (this.capabilities.origin) {
      headers.set('origin', this.capabilities.origin);
    }
    if (context?.requestId) headers.set('x-request-id', context.requestId);
    if (this.capabilities.bearer && context?.authorization) {
      headers.set('authorization', context.authorization);
    }
    if (!this.capabilities.requestSession) return;
    for (const name of CommerceSessionRequestHeaders.values) {
      const raw = context?.sessionHeaders?.[name];
      const value = name === 'cookie' ? CommerceCookiePolicy.allowlisted(raw) : raw;
      if (value) headers.set(name, value);
    }
  }

  override didReceiveResponse({
    response,
    context,
  }: Parameters<
    NonNullable<RemoteGraphQLDataSource<GatewayContext>['didReceiveResponse']>
  >[0]): ReturnType<
    NonNullable<RemoteGraphQLDataSource<GatewayContext>['didReceiveResponse']>
  > {
    if (!this.capabilities.responseSession) return response;
    for (const name of CommerceSessionResponseHeaders.values) {
      const value = response.http?.headers.get(name);
      if (value) context.setResponseHeader?.(name, value);
    }
    const cookies = response.http ? SetCookieValues.from(response.http.headers) : [];
    if (cookies.length > 0) context.setResponseHeader?.('set-cookie', cookies);
    return response;
  }
}
