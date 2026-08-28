import { oauthProvider } from '@better-auth/oauth-provider';
import { Injectable } from '@nestjs/common';

export const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
export const MCP_AUDIENCE = 'https://mcp.marketplace.local';
export const MARKETPLACE_READ_SCOPE = 'marketplace:read';
export const MCP_TOOL_SCOPES = [
  'mcp:tools',
  MARKETPLACE_READ_SCOPE,
  'cart:read',
  'orders:read',
  'cart:write',
] as const;

export type OAuthProviderPluginOptions = Parameters<typeof oauthProvider>[0];

export class OAuthProviderPluginFactory {
  create(
    options: OAuthProviderPluginOptions,
  ): ReturnType<typeof oauthProvider> {
    return oauthProvider(options);
  }
}

Injectable()(OAuthProviderPluginFactory);
