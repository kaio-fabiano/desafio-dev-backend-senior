import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import test from 'node:test';

const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const ignoredDirectories = new Set(['.nx', 'build', 'dist', 'node_modules']);
const contexts = [
  ['commerce', ['order-workflow-subgraph', '/commerce/', '.commerce.']],
  ['gateway', ['/gateway/', '.gateway.']],
  ['identity', ['identity-subgraph', '/identity/', '.identity.']],
  ['inventory', ['stock-worker', '/inventory/', '.inventory.']],
  ['mcp', ['apollo-mcp', '/mcp/', '.mcp.']],
  ['payment', ['payment-federation', '/payment/', '.payment.']],
  [
    'wordpress',
    [
      'wordpress-federation',
      'wordpress-integration',
      '/wordpress/',
      '.wordpress.',
    ],
  ],
];
const forbiddenDependencies = [
  /^@nestjs(?:\/|$)/,
  /^@apollo(?:\/|$)/,
  /^(?:graphql|graphql-sse)(?:\/|$)/,
  /^@mikro-orm(?:\/|$)/,
  /^(?:pg|prisma|typeorm|sequelize|drizzle-orm)(?:\/|$)/,
  /^(?:amqplib|kafkajs|nats|ioredis)(?:\/|$)/,
  /(?:^|\/)(?:infrastructure|persistence|adapters?)(?:\/|$)/,
  /(?:wordpress|woocommerce|wpgraphql)/i,
  /^org\.springframework(?:\.|$)/,
  /^jakarta\.persistence(?:\.|$)/,
  /^org\.hibernate(?:\.|$)/,
  /^(?:com\.rabbitmq|org\.apache\.kafka|io\.nats)(?:\.|$)/,
];

async function sourceFiles(root) {
  const files = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
        await visit(path);
      } else if (sourceExtensions.has(extname(entry.name))) {
        files.push(path);
      }
    }
  }

  await visit(root);
  return files;
}

function isCoreSource(path) {
  const normalized = path.split(sep).join('/');
  return (
    !normalized.includes('/src/test/') &&
    (normalized.includes('/domain/') || normalized.includes('/application/'))
  );
}

function imports(source) {
  const specifiers = [];
  const javascriptImport =
    /\b(?:from\s*|import\s*\(\s*|require\(\s*|import\s*)['"]([^'"]+)['"]/g;
  const javaImport = /^\s*import\s+(?:static\s+)?([\w.]+);?/gm;

  for (const pattern of [javascriptImport, javaImport]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }

  return specifiers;
}

function contextOf(value) {
  const normalized = value.toLowerCase().split('\\').join('/');
  if (
    normalized.includes('/contracts/') ||
    normalized.includes('.contracts.')
  ) {
    return undefined;
  }
  return contexts.find(([, markers]) =>
    markers.some((marker) => normalized.includes(marker)),
  )?.[0];
}

test('AC-091: domain and application code depend only on inward contracts @spec:AC-091', async () => {
  const files = (await Promise.all([sourceFiles('apps'), sourceFiles('libs')]))
    .flat()
    .filter(isCoreSource);
  const violations = [];

  assert.ok(
    files.length > 0,
    'expected at least one domain or application source file',
  );

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sourceContext = contextOf(file);
    for (const dependency of imports(source)) {
      if (forbiddenDependencies.some((pattern) => pattern.test(dependency))) {
        violations.push(`${relative('.', file)} -> ${dependency}`);
      }
      const dependencyContext = contextOf(dependency);
      if (
        sourceContext &&
        dependencyContext &&
        sourceContext !== dependencyContext
      ) {
        violations.push(
          `${relative('.', file)} -> ${dependency} (${sourceContext} imports ${dependencyContext})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('AC-091: the documented dependency matrix keeps technology at the outer boundary @spec:AC-091', async () => {
  const adr = await readFile(
    'docs/adrs/007-federated-platform-boundaries.md',
    'utf8',
  );

  assert.match(adr, /\|\s*Domain\s*\|\s*None\s*\|/);
  assert.match(adr, /\|\s*Application\s*\|\s*Domain and declared ports\s*\|/);
  assert.match(
    adr,
    /\|\s*Adapters\s*\|\s*Application, domain, and contracts\s*\|/,
  );
  assert.match(
    adr,
    /\|\s*Composition\s*\|\s*Adapters and shared platform providers\s*\|/,
  );
  assert.match(
    adr,
    /Across bounded\s+contexts, only versioned contracts and federated references cross/,
  );
});
