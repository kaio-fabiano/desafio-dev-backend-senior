import {
  RemoteGraphQLDataSource,
  type GraphQLDataSourceProcessOptions,
} from '@apollo/gateway';

import type { FederationCapabilities } from '../application/dto/federation-capabilities.dto.ts';
import type { GatewayContext } from '../application/dto/gateway-context.dto.ts';
import { CaptureFederationResponseUseCase } from '../application/use-cases/capture-federation-response.use-case.ts';
import { PrepareFederationRequestUseCase } from '../application/use-cases/prepare-federation-request.use-case.ts';
import { SetCookieValuesAdapter } from '../infrastructure/http/set-cookie-values.adapter.ts';

export class AuthenticatedDataSource extends RemoteGraphQLDataSource<GatewayContext> {
  private readonly capabilities: FederationCapabilities;

  constructor(
    config: { url: string; capabilities?: FederationCapabilities },
    private readonly prepareRequest: PrepareFederationRequestUseCase,
    private readonly captureResponse: CaptureFederationResponseUseCase,
  ) {
    super({ url: config.url });
    this.capabilities = { ...config.capabilities };
  }

  override willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<GatewayContext>) {
    const headers = request.http?.headers;
    if (!headers) return;
    for (const [name, value] of this.prepareRequest.execute(
      this.capabilities,
      context as GatewayContext | undefined,
    )) {
      headers.set(name, value);
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
    const incoming = new Map<string, string | readonly string[]>();
    for (const name of ['woocommerce-session', 'cart-token']) {
      const value = response.http?.headers.get(name);
      if (value) incoming.set(name, value);
    }
    const cookies = response.http
      ? SetCookieValuesAdapter.from(response.http.headers)
      : [];
    if (cookies.length > 0) incoming.set('set-cookie', cookies);
    for (const [name, value] of this.captureResponse.execute(
      this.capabilities,
      incoming,
    )) {
      context.setResponseHeader?.(
        name,
        typeof value === 'string' ? value : [...value],
      );
    }
    return response;
  }
}
