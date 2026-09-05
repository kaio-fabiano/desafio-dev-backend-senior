import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import {
  allowlistedCommerceCookies,
  COMMERCE_SESSION_REQUEST_HEADERS,
  COMMERCE_SESSION_RESPONSE_HEADERS,
  type GatewayContext,
} from '../auth/gateway-context.ts';

// Review: docs/reviews/gateway-auth-refactor.md
export type FederationCapabilities = Readonly<{
  bearer?: boolean;
  origin?: string;
  requestSession?: boolean;
  responseSession?: boolean;
}>;

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
    for (const name of COMMERCE_SESSION_REQUEST_HEADERS) {
      const raw = context?.sessionHeaders?.[name];
      const value = name === 'cookie' ? allowlistedCommerceCookies(raw) : raw;
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
    for (const name of COMMERCE_SESSION_RESPONSE_HEADERS) {
      const value = response.http?.headers.get(name);
      if (value) context.setResponseHeader?.(name, value);
    }
    const cookies = response.http ? setCookieValues(response.http.headers) : [];
    if (cookies.length > 0) context.setResponseHeader?.('set-cookie', cookies);
    return response;
  }
}

function setCookieValues(headers: {
  get(name: string): string | null;
}): string[] {
  const raw = (
    headers as typeof headers & {
      raw?: () => Readonly<Record<string, readonly string[]>>;
    }
  ).raw?.()['set-cookie'];
  if (raw) return [...raw];
  const native = (
    headers as typeof headers & { getSetCookie?: () => readonly string[] }
  ).getSetCookie?.();
  if (native) return [...native];
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}
