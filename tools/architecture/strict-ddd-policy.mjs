export const repositoryApplicationExclusions = [
  'apps/order-workflow-subgraph',
  'apps/payment-federation',
];

const ignoredRepositoryDirectories = new Set([
  '.git',
  '.gradle',
  '.nx',
  '.sst',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'generated',
  'graphify-out',
  'node_modules',
  'target',
]);

const contextualRoots = [
  {
    context: 'edge',
    root: 'apps/gateway',
    sourceRoot: 'apps/gateway/src',
  },
  {
    context: 'identity',
    root: 'apps/identity-subgraph',
    sourceRoot: 'apps/identity-subgraph/src',
  },
  {
    context: 'edge',
    root: 'libs/gateway',
    sourceRoot: 'libs/gateway/nest/src',
  },
  {
    context: 'identity',
    root: 'libs/identity',
    sourceRoot: 'libs/identity/nest/src',
  },
  {
    context: 'platform',
    root: 'libs/platform',
    sourceRoot: 'libs/platform/nest/src',
  },
];

const technicalRoots = [
  ['apps/apollo-mcp', 'integration-contracts', 'shared'],
  ['apps/e2e', 'test-tooling', 'repository'],
  ['apps/wordpress-integration', 'wordpress-plugin', 'commercial'],
  ['libs/contracts', 'contracts', 'shared'],
  ['infra', 'infrastructure', 'repository'],
  ['scripts', 'scripts', 'repository'],
  ['tools', 'tooling', 'repository'],
  ['test', 'test-tooling', 'repository'],
  ['docs', 'documentation', 'repository'],
  ['.agents', 'agent-tooling', 'repository'],
  ['.github', 'delivery-configuration', 'repository'],
  ['.spec', 'specification-governance', 'repository'],
  ['.vscode', 'editor-configuration', 'repository'],
];

const layerNames = new Set([
  'application',
  'composition',
  'domain',
  'infrastructure',
  'presentation',
]);

const explicitOuterBoundaryFiles = new Map([
  ['apps/gateway/src/subscriptions/gateway-sse.options.ts', 'composition'],
  [
    'apps/gateway/src/subscriptions/order-workflow-subscription.client.ts',
    'infrastructure',
  ],
  ['apps/gateway/src/subscriptions/sse-handler.ts', 'presentation'],
  ['libs/gateway/nest/src/auth/auth-context.factory.ts', 'presentation'],
  ['libs/gateway/nest/src/auth/token-verifier.service.ts', 'infrastructure'],
  [
    'libs/gateway/nest/src/federation/authenticated-data-source.ts',
    'infrastructure',
  ],
  [
    'libs/gateway/nest/src/federation/gateway-federation.configuration.ts',
    'composition',
  ],
  [
    'libs/identity/nest/src/better-auth/better-auth.error.ts',
    'infrastructure',
  ],
  [
    'libs/identity/nest/src/better-auth/better-auth.factory.ts',
    'infrastructure',
  ],
  [
    'libs/identity/nest/src/better-auth/identity-auth.types.d.ts',
    'infrastructure',
  ],
  ['libs/identity/nest/src/graphql/user.loader.ts', 'presentation'],
  ['libs/identity/nest/src/graphql/user.repository.ts', 'compatibility'],
  [
    'libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.ts',
    'composition',
  ],
  ['libs/identity/nest/src/oauth-issuer/oauth-resources.ts', 'composition'],
  ['libs/identity/nest/src/oauth-issuer/oauth.error.ts', 'compatibility'],
  [
    'libs/identity/nest/src/registration/identity-bootstrap.ts',
    'infrastructure',
  ],
  [
    'libs/identity/nest/src/registration/registration-compensation.service.ts',
    'composition',
  ],
  [
    'libs/identity/nest/src/registration/registration.error.ts',
    'compatibility',
  ],
  [
    'libs/identity/nest/src/registration/registration.service.ts',
    'presentation',
  ],
  [
    'libs/identity/nest/src/wordpress/wordpress-error-code.d.ts',
    'infrastructure',
  ],
  [
    'libs/identity/nest/src/wordpress/wordpress-identity.service.ts',
    'infrastructure',
  ],
  [
    'libs/identity/nest/src/wordpress/wordpress.error.ts',
    'infrastructure',
  ],
  [
    'libs/platform/nest/src/oauth-resource/oauth-resource.tokens.ts',
    'composition',
  ],
  [
    'libs/platform/nest/src/oauth-resource/oauth-resource.types.ts',
    'composition',
  ],
  [
    'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
    'infrastructure',
  ],
]);

const repositoryRootFiles = new Set([
  '.dockerignore',
  '.gitignore',
  '.prettierignore',
  '.prettierrc',
  'AGENTS.md',
  'README.md',
  'compose.yaml',
  'eslint.config.mjs',
  'nx.json',
  'onpspec.config.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.json',
  'vitest.config.ts',
]);

function isWithin(file, root) {
  return file === root || file.startsWith(`${root}/`);
}

function sourceBoundary(file, sourceRoot) {
  const explicitBoundary = explicitOuterBoundaryFiles.get(file);
  if (explicitBoundary) return explicitBoundary;
  const relative = file.slice(sourceRoot.length + 1);
  const layer = relative.split('/').find((part) => layerNames.has(part));
  if (layer) return layer;
  if (/(?:^|\/)(?:main|index)\.ts$/.test(file)) return 'composition';
  if (/\.(?:module|provider|config)\.ts$/.test(file)) return 'composition';
  if (
    /\.(?:controller|decorator|filter|guard|interceptor|middleware|pipe|resolver)\.ts$/.test(
      file,
    )
  )
    return 'presentation';
  if (/\.(?:adapter|mapper)\.ts$/.test(file)) return 'infrastructure';
  return null;
}

export function classifyRepositoryPath(input) {
  const file = input.split('\\').join('/').replace(/^\.\//, '');
  const contextual = contextualRoots.find(({ root }) => isWithin(file, root));
  if (contextual) {
    return {
      boundary: /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
        ? 'test-tooling'
        : isWithin(file, contextual.sourceRoot)
          ? sourceBoundary(file, contextual.sourceRoot)
          : 'configuration',
      context: contextual.context,
    };
  }

  const technical = technicalRoots.find(([root]) => isWithin(file, root));
  if (technical) {
    const [, boundary, context] = technical;
    return { boundary, context };
  }

  if (
    repositoryRootFiles.has(file) ||
    /^\.env(?:\.|$)/.test(file) ||
    file === 'apps/.gitkeep' ||
    file === 'libs/.gitkeep'
  )
    return {
      boundary: file === 'vitest.config.ts' ? 'test-tooling' : 'configuration',
      context: 'repository',
    };

  return { boundary: null, context: null };
}

export function isExcludedRepositoryPath(file) {
  return repositoryApplicationExclusions.some((root) => isWithin(file, root));
}

export function isIgnoredRepositoryPath(file) {
  return file.split('/').some((part) => ignoredRepositoryDirectories.has(part));
}

export function isProductionSource(file) {
  return (
    /\.(?:[cm]?[jt]sx?|java|php|sh)$/.test(file) &&
    !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
  );
}

export function isProductionTypeScript(file) {
  return /\.[cm]?tsx?$/.test(file) && isProductionSource(file);
}

export function usesStrictTypeScriptRules(file) {
  if (technicalRoots.some(([root]) => isWithin(file, root))) return false;
  const contextual = contextualRoots.find(({ root }) => isWithin(file, root));
  if (contextual) return isWithin(file, contextual.sourceRoot);
  return /^(?:apps|libs)\//.test(file);
}

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
  return ['domain', 'application'].includes(
    classifyRepositoryPath(file).boundary,
  );
}
