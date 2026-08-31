/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const production = input.stage === "production";

    return {
      name: "marketplace",
      home: "aws",
      version: "3.17.37",
      protect: production,
      removal: production ? "retain-all" : "remove",
      providers: {
        aws: {
          version: "6.66.2",
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    const vpc = new sst.aws.Vpc("MarketplaceVpc", { nat: "ec2" });
    const cluster = new sst.aws.Cluster("MarketplaceCluster", { vpc });
    const paymentDatabase = new sst.aws.Postgres("PaymentDatabase", {
      database: "payment",
      version: "17.6",
      vpc,
    });

    const oauthSigningSecret = new sst.Secret("OAuthSigningSecret");
    const wordpressApplicationPassword = new sst.Secret(
      "WordPressApplicationPassword",
    );

    const rabbitMq = new sst.aws.Service("RabbitMq", {
      cluster,
      image: "rabbitmq:4.1.3-management",
      serviceRegistry: { port: 5672 },
    });

    const wordpress = new sst.aws.Service("WordPress", {
      cluster,
      image: "wordpress:6.8.2-php8.3-apache",
      link: [wordpressApplicationPassword],
      serviceRegistry: { port: 80 },
    });

    const identity = new sst.aws.Service("IdentitySubgraph", {
      cluster,
      image: {
        context: "..",
        dockerfile: "apps/identity-subgraph/Dockerfile",
      },
      link: [oauthSigningSecret, wordpressApplicationPassword],
      serviceRegistry: { port: 3001 },
    });

    const paymentProcessor = new sst.aws.Service("PaymentProcessor", {
      cluster,
      image: {
        context: "..",
        dockerfile: "apps/payment-processor/Dockerfile",
      },
      link: [paymentDatabase],
    });

    const gateway = new sst.aws.Service("Gateway", {
      cluster,
      image: {
        context: "..",
        dockerfile: "apps/gateway/Dockerfile",
      },
      loadBalancer: {
        rules: [{ listen: "80/http", forward: "3000/http" }],
      },
    });

    const apolloMcp = new sst.aws.Service("ApolloMcp", {
      cluster,
      image: {
        context: "..",
        dockerfile: "apps/apollo-mcp/Dockerfile",
      },
      loadBalancer: {
        rules: [{ listen: "80/http", forward: "8000/http" }],
      },
    });

    return {
      apolloMcpUrl: apolloMcp.url,
      gatewayUrl: gateway.url,
      resourceNames: [
        "IdentitySubgraph",
        "PaymentProcessor",
        "RabbitMq",
        "WordPress",
      ],
    };
  },
});
