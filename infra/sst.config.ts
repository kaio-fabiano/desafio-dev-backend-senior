/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const production = input.stage === 'production';

    return {
      name: 'marketplace',
      home: 'aws',
      version: '3.17.37',
      protect: production,
      removal: production ? 'retain-all' : 'remove',
      providers: {
        aws: {
          version: '6.66.2',
          region: 'us-east-1',
        },
      },
    };
  },
  async run() {
    const vpc = new sst.aws.Vpc('MarketplaceVpc', {
      nat: { type: 'ec2', ec2: { instance: 't4g.micro' } },
    });
    const cluster = new sst.aws.Cluster('MarketplaceCluster', { vpc });
    const publicApi = new sst.aws.ApiGatewayV2('PublicApi', { vpc });
    const publicOAuthIssuer = $interpolate`${publicApi.url}/api/auth`;
    const identityDatabase = new sst.aws.Aurora('IdentityDatabase', {
      database: 'identity',
      engine: 'postgres',
      vpc,
    });
    const orderWorkflowDatabase = new sst.aws.Aurora('OrderWorkflowDatabase', {
      database: 'order_workflow',
      engine: 'postgres',
      vpc,
    });
    const paymentDatabase = new sst.aws.Postgres('PaymentDatabase', {
      database: 'payment',
      version: '17.6',
      vpc,
    });
    const wordpressDatabase = new sst.aws.Aurora('WordPressDatabase', {
      database: 'wordpress',
      engine: 'mysql',
      vpc,
    });

    const oauthSigningSecret = new sst.Secret('OAuthSigningSecret');
    const identitySeedAdminPassword = new sst.Secret(
      'IdentitySeedAdminPassword',
    );
    const wordpressAdminPassword = new sst.Secret('WordPressAdminPassword');
    const wordpressApplicationPassword = new sst.Secret(
      'WordPressApplicationPassword',
    );
    const wordpressConsumerKey = new sst.Secret('WordPressConsumerKey');
    const wordpressConsumerSecret = new sst.Secret('WordPressConsumerSecret');
    const mercadoPagoAccessToken = new sst.Secret('MercadoPagoAccessToken');
    const mercadoPagoWebhookSecret = new sst.Secret('MercadoPagoWebhookSecret');

    const serviceHost = (name: string, port: number) =>
      `http://${name}.${$app.stage}.${$app.name}.sst:${port}`;

    const rabbitMq = new sst.aws.Service('RabbitMq', {
      cluster,
      health: {
        command: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping'],
      },
      image: 'rabbitmq:4.1.3-management',
      serviceRegistry: { port: 5672 },
    });

    const wordpress = new sst.aws.Service('WordPress', {
      cluster,
      environment: {
        WORDPRESS_DB_HOST: $interpolate`${wordpressDatabase.host}:${wordpressDatabase.port}`,
        WORDPRESS_DB_NAME: wordpressDatabase.database,
        WORDPRESS_DB_PASSWORD: wordpressDatabase.password,
        WORDPRESS_DB_USER: wordpressDatabase.username,
        WORDPRESS_ADMIN_PASSWORD: wordpressAdminPassword.value,
        WORDPRESS_URL: serviceHost('WordPress', 80),
        WOO_CONSUMER_KEY: wordpressConsumerKey.value,
        WOO_CONSUMER_SECRET: wordpressConsumerSecret.value,
        WPGRAPHQL_SITE_TOKEN: wordpressApplicationPassword.value,
      },
      health: {
        command: [
          'CMD-SHELL',
          'test -f /var/www/html/.marketplace-ready && curl --fail --silent http://127.0.0.1/graphql',
        ],
      },
      image: {
        context: '..',
        dockerfile: 'apps/wordpress-integration/Dockerfile',
      },
      link: [
        wordpressDatabase,
        wordpressAdminPassword,
        wordpressApplicationPassword,
        wordpressConsumerKey,
        wordpressConsumerSecret,
      ],
      serviceRegistry: { port: 80 },
    });

    const identity = new sst.aws.Service('IdentitySubgraph', {
      cluster,
      environment: {
        BETTER_AUTH_SECRET: oauthSigningSecret.value,
        DATABASE_URL: $interpolate`postgresql://${identityDatabase.username}:${identityDatabase.password}@${identityDatabase.host}:${identityDatabase.port}/${identityDatabase.database}`,
        IDENTITY_BASE_URL: publicOAuthIssuer,
        IDENTITY_JWKS_URL: `${serviceHost('IdentitySubgraph', 3001)}/api/auth/jwks`,
        NODE_ENV: 'production',
        OAUTH_ISSUER: publicOAuthIssuer,
        PORT: '3001',
        SEED_ADMIN_PASSWORD: identitySeedAdminPassword.value,
        WOO_CONSUMER_KEY: wordpressConsumerKey.value,
        WOO_CONSUMER_SECRET: wordpressConsumerSecret.value,
        WORDPRESS_URL: serviceHost('WordPress', 80),
      },
      health: {
        command: [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3001/ready').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
      },
      image: {
        context: '..',
        dockerfile: 'apps/identity-subgraph/Dockerfile',
      },
      link: [
        identityDatabase,
        oauthSigningSecret,
        identitySeedAdminPassword,
        wordpressConsumerKey,
        wordpressConsumerSecret,
      ],
      serviceRegistry: { port: 3001 },
    });

    const orderWorkflow = new sst.aws.Service('OrderWorkflowSubgraph', {
      cluster,
      environment: {
        IDENTITY_JWKS_URL: `${serviceHost('IdentitySubgraph', 3001)}/api/auth/jwks`,
        NODE_ENV: 'production',
        OAUTH_ISSUER: publicOAuthIssuer,
        ORDER_WORKFLOW_DB_HOST: orderWorkflowDatabase.host,
        ORDER_WORKFLOW_DB_NAME: orderWorkflowDatabase.database,
        ORDER_WORKFLOW_DB_PASSWORD: orderWorkflowDatabase.password,
        ORDER_WORKFLOW_DB_PORT: orderWorkflowDatabase.port.apply(String),
        ORDER_WORKFLOW_DB_USER: orderWorkflowDatabase.username,
        PORT: '3003',
        RABBITMQ_URL: serviceHost('RabbitMq', 5672).replace('http', 'amqp'),
        WOO_CONSUMER_KEY: wordpressConsumerKey.value,
        WOO_CONSUMER_SECRET: wordpressConsumerSecret.value,
        WORDPRESS_URL: serviceHost('WordPress', 80),
      },
      health: {
        command: [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3003/ready').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
      },
      image: {
        context: '..',
        dockerfile: 'apps/order-workflow-subgraph/Dockerfile',
      },
      link: [
        orderWorkflowDatabase,
        rabbitMq,
        wordpressConsumerKey,
        wordpressConsumerSecret,
      ],
      serviceRegistry: { port: 3003 },
    });

    const paymentFederation = new sst.aws.Service('PaymentFederation', {
      cluster,
      environment: {
        IDENTITY_JWKS_URL: `${serviceHost('IdentitySubgraph', 3001)}/api/auth/jwks`,
        MERCADO_PAGO_ACCESS_TOKEN: mercadoPagoAccessToken.value,
        MERCADO_PAGO_API_BASE_URL: 'https://api.mercadopago.com',
        MERCADO_PAGO_CONNECTION_TIMEOUT: '5s',
        MERCADO_PAGO_READ_TIMEOUT: '15s',
        MERCADO_PAGO_WEBHOOK_SECRET: mercadoPagoWebhookSecret.value,
        OAUTH_ISSUER: publicOAuthIssuer,
        PAYMENT_PROVIDER_MODE: 'mercado-pago',
        RABBITMQ_URL: serviceHost('RabbitMq', 5672).replace('http', 'amqp'),
        SERVER_PORT: '8080',
        SPRING_DATASOURCE_PASSWORD: paymentDatabase.password,
        SPRING_DATASOURCE_URL: $interpolate`jdbc:postgresql://${paymentDatabase.host}:${paymentDatabase.port}/${paymentDatabase.database}`,
        SPRING_DATASOURCE_USERNAME: paymentDatabase.username,
        WORDPRESS_GRAPHQL_URL: `${serviceHost('WordPress', 80)}/graphql`,
        WPGRAPHQL_SITE_TOKEN: wordpressApplicationPassword.value,
      },
      health: {
        command: [
          'CMD-SHELL',
          'curl --fail --silent http://127.0.0.1:8080/actuator/health',
        ],
        startPeriod: '60 seconds',
      },
      image: {
        context: '..',
        dockerfile: 'apps/payment-federation/Dockerfile',
      },
      link: [
        paymentDatabase,
        rabbitMq,
        wordpressApplicationPassword,
        mercadoPagoAccessToken,
        mercadoPagoWebhookSecret,
      ],
      serviceRegistry: { port: 8080 },
    });

    const gateway = new sst.aws.Service('Gateway', {
      cluster,
      environment: {
        GATEWAY_AUDIENCE: 'https://gateway.marketplace.local',
        IDENTITY_GRAPHQL_URL: `${serviceHost('IdentitySubgraph', 3001)}/graphql`,
        IDENTITY_JWKS_URL: `${serviceHost('IdentitySubgraph', 3001)}/api/auth/jwks`,
        NODE_ENV: 'production',
        OAUTH_ISSUER: publicOAuthIssuer,
        ORDER_WORKFLOW_GRAPHQL_URL: `${serviceHost('OrderWorkflowSubgraph', 3003)}/graphql`,
        ORDER_WORKFLOW_SUBSCRIPTION_URL: `${serviceHost('OrderWorkflowSubgraph', 3003)}/graphql/stream`,
        PAYMENT_GRAPHQL_URL: `${serviceHost('PaymentFederation', 8080)}/graphql`,
        PORT: '3000',
        WORDPRESS_GRAPHQL_URL: `${serviceHost('WordPress', 80)}/graphql`,
      },
      health: {
        command: [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3000/ready').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
      },
      image: {
        context: '..',
        dockerfile: 'apps/gateway/Dockerfile',
      },
      link: [identity, orderWorkflow, paymentFederation, wordpress],
      serviceRegistry: { port: 3000 },
    });

    const apolloMcp = new sst.aws.Service('ApolloMcp', {
      cluster,
      command: [
        'sed -i "s|http://gateway:3000/graphql|$GATEWAY_GRAPHQL_URL|; s|http://identity.localhost:3001/api/auth|$IDENTITY_OAUTH_URL|g; s|http://apollo-mcp:8000/mcp|$MCP_RESOURCE_URL|g; s|public-api.invalid|$PUBLIC_API_HOST|g" /data/mcp.yaml && exec apollo-mcp-server /data/mcp.yaml',
      ],
      entrypoint: ['/bin/busybox', 'sh', '-ec'],
      environment: {
        GATEWAY_GRAPHQL_URL: `${serviceHost('Gateway', 3000)}/graphql`,
        IDENTITY_OAUTH_URL: publicOAuthIssuer,
        MCP_RESOURCE_URL: $interpolate`${publicApi.url}/mcp`,
        PUBLIC_API_HOST: publicApi.url.apply((url) => new URL(url).host),
      },
      health: {
        command: [
          'CMD',
          '/bin/wget',
          '--quiet',
          '--spider',
          'http://127.0.0.1:8000/health',
        ],
      },
      image: {
        context: '..',
        dockerfile: 'apps/apollo-mcp/Dockerfile',
      },
      link: [gateway, identity],
      serviceRegistry: { port: 8000 },
    });

    publicApi.routePrivate('ANY /api/auth', identity.nodes.cloudmapService.arn);
    publicApi.routePrivate(
      'ANY /api/auth/{proxy+}',
      identity.nodes.cloudmapService.arn,
    );
    publicApi.routePrivate(
      'POST /webhooks/mercado-pago',
      paymentFederation.nodes.cloudmapService.arn,
    );
    publicApi.routePrivate('ANY /mcp', apolloMcp.nodes.cloudmapService.arn);
    publicApi.routePrivate(
      'ANY /mcp/{proxy+}',
      apolloMcp.nodes.cloudmapService.arn,
    );
    publicApi.routePrivate('GET /health', apolloMcp.nodes.cloudmapService.arn);
    publicApi.routePrivate('$default', gateway.nodes.cloudmapService.arn);

    return {
      apolloMcpUrl: $interpolate`${publicApi.url}/mcp`,
      gatewayUrl: publicApi.url,
      mercadoPagoWebhookUrl: $interpolate`${publicApi.url}/webhooks/mercado-pago`,
      resourceNames: [
        'ApolloMcp',
        'Gateway',
        'IdentitySubgraph',
        'OrderWorkflowSubgraph',
        'PaymentFederation',
        'RabbitMq',
        'WordPress',
      ],
    };
  },
});
