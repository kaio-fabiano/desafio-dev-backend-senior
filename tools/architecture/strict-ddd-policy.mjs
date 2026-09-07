export const strictDddRoots = [
  'libs/platform/nest/src',
  'libs/gateway/nest/src',
  'apps/gateway/src',
  'libs/identity/nest/src',
  'apps/identity-subgraph/src',
];

export const forbiddenCoreDependencies = [
  /^@nestjs(?:\/|$)/,
  /^@apollo(?:\/|$)/,
  /^(?:graphql|graphql-sse)(?:\/|$)/,
  /^@mikro-orm(?:\/|$)/,
  /^(?:pg|prisma|typeorm|sequelize|drizzle-orm)(?:\/|$)/,
  /^(?:amqplib|kafkajs|nats|ioredis)(?:\/|$)/,
  /(?:^|\/)(?:infrastructure|persistence|adapters?|presentation)(?:\/|$)/,
];

export function isDedicatedFile(file) {
  return (
    file.endsWith('/main.ts') ||
    file.endsWith('/index.ts') ||
    file.endsWith('.d.ts') ||
    file.endsWith('.decorator.ts') ||
    file.includes('/migrations/') ||
    file.includes('/generated/')
  );
}

export function isConfigFile(file) {
  return file.endsWith('.config.ts');
}

export function isCoreLayer(file) {
  return /\/(?:domain|application)\//.test(file);
}
