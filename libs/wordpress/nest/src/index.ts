export {
  WORDPRESS_FEDERATION_CONFIG,
  WordPressFederationModule,
  type WordPressFederationConfig,
} from './federation/wordpress-federation.module.ts';
export {
  WpGraphqlClientService,
  normalizeWordPressSdl,
  type WpGraphqlProxyRequest,
  type WpGraphqlProxyResponse,
} from './federation/wpgraphql-client.service.ts';
export {
  WpGraphqlAuthorizationError,
  createWpGraphqlAuth,
  type WpGraphqlAuth,
  type WpGraphqlOperation,
} from './federation/wpgraphql-auth.factory.ts';
