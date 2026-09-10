import { OAuthClientProvisioningPolicy } from '../application/policies/oauth-client-provisioning.policy.ts';
import { IdentityUserVisibilityPolicy } from '../application/policies/identity-user-visibility.policy.ts';

export class OAuthResources {
  static readonly resources = {
    gateway: 'https://gateway.marketplace.local',
    identity: 'https://identity.marketplace.local',
    mcp: 'https://mcp.marketplace.local',
    orderWorkflow: 'https://order-workflow.marketplace.local',
    payment: 'https://payment.marketplace.local',
  } as const;
  static readonly marketplaceReadScope = IdentityUserVisibilityPolicy.selfScope;
  static readonly identityUsersReadScope =
    IdentityUserVisibilityPolicy.administrativeScope;
  static readonly delegatedScopes = [
    'mcp:tools',
    OAuthResources.marketplaceReadScope,
    'cart:read',
    'orders:read',
    'cart:write',
  ] as const satisfies typeof OAuthClientProvisioningPolicy.delegatedScopes;
  static readonly gatewayAudience = OAuthResources.resources.gateway;
  static readonly mcpAudience = OAuthResources.resources.mcp;
  static readonly resourceScopes = {
    [OAuthResources.resources.gateway]: OAuthResources.delegatedScopes,
    [OAuthResources.resources.identity]: [
      ...OAuthResources.delegatedScopes,
      OAuthResources.identityUsersReadScope,
    ],
    [OAuthResources.resources.mcp]: OAuthResources.delegatedScopes,
    [OAuthResources.resources.orderWorkflow]: OAuthResources.delegatedScopes,
    [OAuthResources.resources.payment]: OAuthResources.delegatedScopes,
  } as const;
}
