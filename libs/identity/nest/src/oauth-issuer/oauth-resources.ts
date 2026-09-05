// OAuth resource policy shared by the issuer and resource-server guards.
export const OAUTH_RESOURCES = {
  gateway: 'https://gateway.marketplace.local',
  identity: 'https://identity.marketplace.local',
  mcp: 'https://mcp.marketplace.local',
  orderWorkflow: 'https://order-workflow.marketplace.local',
  payment: 'https://payment.marketplace.local',
} as const;

export const MARKETPLACE_READ_SCOPE = 'marketplace:read';

export const DELEGATED_OAUTH_SCOPES = [
  'mcp:tools',
  MARKETPLACE_READ_SCOPE,
  'cart:read',
  'orders:read',
  'cart:write',
] as const;

export const GATEWAY_AUDIENCE = OAUTH_RESOURCES.gateway;
export const MCP_AUDIENCE = OAUTH_RESOURCES.mcp;

// Better Auth 1.7.1 intersects allowed scopes across every audience in one
// multi-resource token. The platform deliberately forwards that same token to
// each owning resource server, where operation-level guards enforce its scopes.
export const OAUTH_RESOURCE_SCOPES = {
  [OAUTH_RESOURCES.gateway]: DELEGATED_OAUTH_SCOPES,
  [OAUTH_RESOURCES.identity]: DELEGATED_OAUTH_SCOPES,
  [OAUTH_RESOURCES.mcp]: DELEGATED_OAUTH_SCOPES,
  [OAUTH_RESOURCES.orderWorkflow]: DELEGATED_OAUTH_SCOPES,
  [OAUTH_RESOURCES.payment]: DELEGATED_OAUTH_SCOPES,
} as const;
