export const OAUTH_RESOURCES = {
  gateway: 'https://gateway.marketplace.local',
  identity: 'https://identity.marketplace.local',
  mcp: 'https://mcp.marketplace.local',
  orderWorkflow: 'https://order-workflow.marketplace.local',
  payment: 'https://payment.marketplace.local',
} as const;

export const MARKETPLACE_OAUTH_SCOPES = [
  'mcp:tools',
  'marketplace:read',
  'cart:read',
  'orders:read',
  'cart:write',
] as const;

export const GATEWAY_AUDIENCE = OAUTH_RESOURCES.gateway;
export const MCP_AUDIENCE = OAUTH_RESOURCES.mcp;
export const MARKETPLACE_READ_SCOPE = 'marketplace:read';
export const MCP_TOOL_SCOPES = MARKETPLACE_OAUTH_SCOPES;

export const OAUTH_RESOURCE_SCOPES = {
  [OAUTH_RESOURCES.gateway]: MARKETPLACE_OAUTH_SCOPES,
  [OAUTH_RESOURCES.identity]: ['marketplace:read'],
  [OAUTH_RESOURCES.mcp]: MARKETPLACE_OAUTH_SCOPES,
  [OAUTH_RESOURCES.orderWorkflow]: [
    'cart:read',
    'orders:read',
    'cart:write',
  ],
  [OAUTH_RESOURCES.payment]: ['orders:read', 'cart:write'],
} as const;
