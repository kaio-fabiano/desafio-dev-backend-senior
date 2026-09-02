import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  classifyAuthorizationResult,
  mergeResponseCookies,
  readTerminalEvent,
} from '../apps/e2e/src/journey.ts';

const [packageJson, project, environment, journey, acceptance] =
  await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/src/environment.ts', 'utf8'),
    readFile('apps/e2e/src/journey.ts', 'utf8'),
    readFile('apps/e2e/src/milestone-7.e2e.test.ts', 'utf8'),
  ]);

test('AC-067: one Vitest target owns real Compose startup and unconditional teardown @spec:AC-067', () => {
  assert.equal(packageJson.devDependencies.testcontainers, '11.7.2');
  assert.equal(packageJson.devDependencies.vitest, '3.2.4');
  assert.equal(
    packageJson.scripts['acceptance:milestone-7'],
    'nx run @desafio-dev-backend-senior/e2e:acceptance',
  );
  assert.match(
    project.targets.acceptance.options.command,
    /^vitest run apps\/e2e\/src\/milestone-7\.e2e\.test\.ts/,
  );
  assert.match(environment, /DockerComposeEnvironment/);
  assert.match(environment, /\.withBuild\(\)/);
  assert.doesNotMatch(
    environment,
    /SERVICE_SOURCE|node', '-e'|createServer|ROLE/,
  );
  for (const component of [
    'identity-database',
    'order-workflow-database',
    'payment-database',
    'wordpress-database',
    'wordpress',
    'wordpress-setup',
    'identity-subgraph',
    'order-workflow-subgraph',
    'rabbitmq',
    'payment-federation',
    'gateway',
    'apollo-mcp',
  ]) {
    assert.match(
      environment,
      new RegExp(component.replaceAll('.', '\\.'), 'i'),
    );
  }
  assert.match(environment, /catch \(error\)[\s\S]*await stop\(\)/);
  assert.match(
    acceptance,
    /afterAll\(async \(\) => \{[\s\S]*environment\?\.stop\(\)/,
  );
});

test('AC-071: OAuth distinguishes direct redirects from consent challenges @spec:AC-071', () => {
  assert.deepEqual(
    classifyAuthorizationResult(
      'http://127.0.0.1/callback?code=approved&state=x',
      'http://identity',
    ),
    { kind: 'code', code: 'approved' },
  );
  assert.deepEqual(
    classifyAuthorizationResult(
      '/consent?client_id=gateway&sig=signed',
      'http://identity',
    ),
    { kind: 'consent', oauthQuery: 'client_id=gateway&sig=signed' },
  );
});

test('AC-068..AC-071: the journey uses Gateway, MCP, and federated SSE @spec:AC-068 @spec:AC-069 @spec:AC-070 @spec:AC-071', () => {
  assert.doesNotMatch(
    journey,
    /\.\.\/\.\.\/(?:gateway|identity-subgraph|order-workflow-subgraph|payment-federation|stock-worker)/,
  );
  assert.match(journey, /environment\.gatewayUrl/);
  assert.match(journey, /environment\.mcpUrl/);
  assert.match(journey, /gatewayUrl\}\/graphql\/stream/);
  assert.match(journey, /authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(
    journey,
    /x-authenticated-subject|x-authenticated-scopes/,
  );
  assert.match(journey, /api\/auth\/sign-up\/email/);
  assert.match(journey, /api\/auth\/oauth2\/authorize/);
  assert.match(journey, /api\/auth\/oauth2\/consent/);
  assert.match(journey, /api\/auth\/oauth2\/token/);
  assert.match(
    journey,
    /const nextEvent = await subscribe\([\s\S]*'startCheckout'/,
  );
  assert.doesNotMatch(
    journey,
    /updateOrder|recordPixPaymentV1|recordCardPaymentV1/,
  );
  assert.match(journey, /cardRetry/);
  assert.match(journey, /meAndProducts/);
  assert.match(journey, /startCheckout/);
  assert.match(journey, /rejectionStatuses/);
  for (const criterion of ['AC-068', 'AC-069', 'AC-070', 'AC-071']) {
    assert.match(acceptance, new RegExp(`@spec:${criterion}`));
  }
});

test('AC-069: batched GraphQL SSE frames still expose the terminal event @spec:AC-069', async () => {
  const frame = (state) =>
    `event: next\ndata: ${JSON.stringify({ data: { orderEvents: { operationKey: 'card', state } } })}\n\n`;
  const response = new Response(frame('PAYMENT_PENDING') + frame('COMPLETED'), {
    headers: { 'content-type': 'text/event-stream' },
  });

  assert.deepEqual(await readTerminalEvent(response, 'card', 'COMPLETED'), {
    operationKey: 'card',
    state: 'COMPLETED',
  });
});

test('AC-114: acceptance proves the complete public buyer contract @spec:AC-114', () => {
  for (const assertion of [
    /cardRetry/,
    /compensation/,
    /meAndProducts/,
    /rejectionStatuses/,
    /'PIX'/,
  ]) {
    assert.match(journey, assertion);
  }
  assert.match(acceptance, /proof\.mcp/);
  assert.match(environment, /rabbitmq/);
  assert.match(environment, /payment-federation/);
  assert.doesNotMatch(journey, /recordPixPaymentV1|recordCardPaymentV1/);
});

test('AC-071: OAuth grants carry forward rotated signed cookies @spec:AC-071', () => {
  const response = new Response(null, {
    headers: [
      ['set-cookie', 'session=new; Path=/; HttpOnly'],
      ['set-cookie', 'oauth_signature=signed; Path=/; HttpOnly'],
      ['set-cookie', 'preference=; Max-Age=0; Path=/'],
    ],
  });
  assert.equal(
    mergeResponseCookies('session=old; preference=kept', response),
    'session=new; oauth_signature=signed',
  );
});
