import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';
import { composeServices } from '../node_modules/.pnpm/@apollo+composition@2.14.4_graphql@16.11.0/node_modules/@apollo/composition/dist/index.js';

const deployableProjects = [
  'apps/apollo-mcp/project.json',
  'apps/gateway/project.json',
  'apps/identity-subgraph/project.json',
  'apps/commerce-subgraph/project.json',
  'apps/payment-processor/project.json',
];
const deployableProjectNames = [
  '@desafio-dev-backend-senior/apollo-mcp',
  '@desafio-dev-backend-senior/gateway',
  '@desafio-dev-backend-senior/identity-subgraph',
  '@desafio-dev-backend-senior/commerce-subgraph',
  '@desafio-dev-backend-senior/payment-processor',
];

function composeServiceNames(source) {
  const services = source.match(/^services:\n([\s\S]*?)(?=^\S|\Z)/m)?.[1] ?? '';
  return [...services.matchAll(/^  ([\w-]+):$/gm)].map(([, name]) => name);
}

function supergraphNames(source) {
  const subgraphs = source.match(/^subgraphs:\n([\s\S]*)$/m)?.[1] ?? '';
  return [...subgraphs.matchAll(/^  ([\w-]+):$/gm)].map(([, name]) => name);
}

test('AC-090: only five deployable applications and the E2E project remain active @spec:AC-090', async () => {
  const [compose, projects, e2e, allProjects] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    Promise.all(
      deployableProjects.map((path) => readFile(path, 'utf8').then(JSON.parse)),
    ),
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    (async () => {
      const paths = await Array.fromAsync(glob('apps/*/project.json'));
      return Promise.all(
        [...paths, 'infra/project.json'].map((path) =>
          readFile(path, 'utf8').then(JSON.parse),
        ),
      );
    })(),
  ]);

  assert.deepEqual(
    projects.map(({ name }) => name),
    deployableProjectNames,
  );
  assert.ok(projects.every(({ projectType }) => projectType === 'application'));
  assert.deepEqual(e2e.tags, ['type:e2e', 'scope:delivery']);
  assert.deepEqual(
    allProjects
      .filter(({ projectType }) => projectType === 'application')
      .map(({ name }) => name)
      .sort(),
    [...deployableProjectNames, '@desafio-dev-backend-senior/e2e'].sort(),
  );

  const services = composeServiceNames(compose);
  assert.deepEqual(
    services.filter((name) =>
      [
        'apollo-mcp',
        'commerce-subgraph',
        'gateway',
        'identity-subgraph',
        'payment-processor',
        'stock-worker',
      ].includes(name),
    ),
    [
      'gateway',
      'apollo-mcp',
      'identity-subgraph',
      'commerce-subgraph',
      'payment-processor',
    ],
  );
});

test('AC-098: Commerce workflow and Java inventory consumers use the active topology @spec:AC-098', async () => {
  const [compose, supergraph, environment, paymentBuild, paymentConfig] =
    await Promise.all([
      readFile('compose.yaml', 'utf8'),
      readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
      readFile('apps/e2e/src/environment.ts', 'utf8'),
      readFile('apps/payment-processor/build.gradle.kts', 'utf8'),
      readFile(
        'apps/payment-processor/src/main/resources/application.yaml',
        'utf8',
      ),
    ]);

  const services = composeServiceNames(compose);
  assert.ok(services.includes('wordpress'));
  assert.ok(services.includes('payment-processor'));
  assert.ok(services.includes('commerce-subgraph'));
  assert.ok(!services.includes('stock-worker'));
  assert.deepEqual(supergraphNames(supergraph), [
    'identity',
    'wordpress',
    'payment',
    'commerce',
  ]);
  assert.match(supergraph, /\.\/commerce\/schema\.graphql/);

  const activeComponents = environment.match(
    /const COMPOSE_SERVICES = \[([\s\S]*?)\] as const;/,
  )?.[1];
  assert.ok(
    activeComponents,
    'the E2E environment must declare active services',
  );
  assert.match(activeComponents, /'wordpress'/);
  assert.match(activeComponents, /'commerce-subgraph'/);
  assert.match(activeComponents, /'rabbitmq'/);
  assert.doesNotMatch(activeComponents, /'stock-worker'/);
  assert.match(compose, /^  rabbitmq:/m);
  assert.match(paymentBuild, /spring-boot-starter-amqp/);
  assert.match(paymentConfig, /rabbitmq:/i);
});

test('AC-099: Payment is composed as the Spring GraphQL Federation subgraph @spec:AC-099', async () => {
  const [compose, supergraph, project, springConfiguration, services] =
    await Promise.all([
      readFile('compose.yaml', 'utf8'),
      readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
      readFile('apps/payment-processor/project.json', 'utf8').then(JSON.parse),
      readFile(
        'apps/payment-processor/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java',
        'utf8',
      ),
      Promise.all(
        ['identity', 'wordpress', 'payment'].map(async (name) => ({
          name,
          url: `http://${name}/graphql`,
          typeDefs: await readFile(
            `libs/contracts/graphql/${name}/schema.graphql`,
            'utf8',
          ),
        })),
      ),
    ]);

  assert.match(
    supergraph,
    /payment:\n\s+routing_url: http:\/\/payment-processor:8080\/graphql\n\s+schema:\n\s+file: \.\/payment\/schema\.graphql/,
  );
  assert.match(compose, /^  payment-processor:\n[\s\S]*?SERVER_PORT: 8080/m);
  assert.equal(project.tags.includes('scope:payment'), true);
  assert.match(project.targets.build.options.command, /gradle.*bootJar/);
  assert.match(springConfiguration, /FederationSchemaFactory/);

  const composition = composeServices(services);
  assert.equal(
    composition.errors?.length ?? 0,
    0,
    composition.errors?.map(({ message }) => message).join('\n'),
  );
  assert.match(composition.supergraphSdl, /enum join__Graph \{[\s\S]*PAYMENT/);
});
