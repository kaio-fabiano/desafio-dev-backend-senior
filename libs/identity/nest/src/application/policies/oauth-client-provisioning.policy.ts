import { OAuthClientDefinition } from '../dto/oauth-client-definition.dto.ts';

export class OAuthClientProvisioningPolicy {
  static readonly resources = {
    gateway: 'https://gateway.marketplace.local',
    identity: 'https://identity.marketplace.local',
    mcp: 'https://mcp.marketplace.local',
    orderWorkflow: 'https://order-workflow.marketplace.local',
    payment: 'https://payment.marketplace.local',
  } as const;
  static readonly delegatedScopes = [
    'mcp:tools',
    'marketplace:read',
    'cart:read',
    'orders:read',
    'cart:write',
  ] as const;
  static readonly gateway = new OAuthClientDefinition(
    'Marketplace gateway',
    'http://127.0.0.1:4000/oauth/callback',
    'identity-gateway',
    ['openid', 'profile', ...OAuthClientProvisioningPolicy.delegatedScopes],
  );
  static readonly mcp = new OAuthClientDefinition(
    'Apollo MCP',
    'http://127.0.0.1:6274/oauth/callback',
    'apollo-mcp',
    ['openid', 'profile', ...OAuthClientProvisioningPolicy.delegatedScopes],
  );
}
