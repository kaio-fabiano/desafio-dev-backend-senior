import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import ts from 'typescript';

import { HealthController } from '../apps/gateway/src/health.controller.ts';
import { GatewayRuntimeMessages } from '../apps/gateway/src/presentation/gateway-runtime-messages.ts';
import { GatewayErrorMessages } from '../libs/gateway/nest/src/application/gateway-error-messages.ts';
import { GatewayJwtHeaderAdapter } from '../libs/gateway/nest/src/infrastructure/auth/gateway-jwt-header.adapter.ts';
import { GatewayRequestAdapter } from '../libs/gateway/nest/src/infrastructure/http/gateway-request.adapter.ts';
import { GatewayUnauthenticatedError } from '../libs/gateway/nest/src/presentation/graphql/gateway-unauthenticated.error.ts';

const sourceRoots = ['apps/gateway/src', 'libs/gateway/nest/src'];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return nested
    .flat()
    .filter((file) => /\.ts$/.test(file) && !/\.spec\.ts$/.test(file));
}

function usesGatewayMessageCatalog(expression) {
  const reference = ts.isCallExpression(expression)
    ? expression.expression
    : expression;
  return (
    ts.isPropertyAccessExpression(reference) &&
    ts.isIdentifier(reference.expression) &&
    reference.expression.text.endsWith('Messages')
  );
}

function errorConstructionViolations(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations = [];

  function visit(node) {
    if (
      ts.isNewExpression(node) &&
      /(?:Error|Exception)$/.test(node.expression.getText(sourceFile))
    ) {
      const message = node.arguments?.[0];
      if (!message || !usesGatewayMessageCatalog(message)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push({
          file,
          line: line + 1,
          reason: message ? 'unnamed-message' : 'missing-message',
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

test('Gateway TypeScript exception construction uses named messages @spec:AC-298 @principle:P-003', async () => {
  const files = (await Promise.all(sourceRoots.map(sourceFiles))).flat();
  const violations = (
    await Promise.all(
      files.map(async (file) =>
        errorConstructionViolations(file, await readFile(file, 'utf8')),
      ),
    )
  ).flat();

  assert.deepEqual(violations, []);
});

test('Gateway custom errors provide documented messages @spec:AC-300', () => {
  const error = GatewayUnauthenticatedError.create();

  assert.equal(error.message, 'Unauthorized');
  assert.notEqual(error.message.trim(), '');
});

test('Gateway observable error text remains compatible @spec:AC-301', () => {
  assert.equal(
    GatewayRuntimeMessages.subscriptionUnauthenticated,
    'Unauthenticated subscription',
  );
  assert.equal(
    GatewayErrorMessages.subgraphUrlIsRequired('identity'),
    'Subgraph identity URL is required',
  );
  assert.throws(
    () => GatewayRequestAdapter.trustedOrigin('ftp://gateway.example'),
    { message: 'Gateway origin must use HTTP or HTTPS' },
  );
  assert.throws(
    () =>
      GatewayRequestAdapter.toRequest(
        { method: 'GET', rawHeaders: [], url: 'https://attacker.example' },
        'https://gateway.example',
      ),
    { message: 'Gateway request target must be an absolute path' },
  );
  assert.throws(() => GatewayJwtHeaderAdapter.assert('Bearer invalid'), {
    message: 'Access token must be a compact JWT',
  });
  assert.throws(() => GatewayJwtHeaderAdapter.assert('Bearer %%%.e30.x'), {
    message: 'Access token header must be valid JSON',
  });
  assert.throws(
    () =>
      GatewayJwtHeaderAdapter.assert(
        `Bearer ${Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url')}.e30.x`,
      ),
    { message: 'Access token key ID is required' },
  );
  assert.throws(
    () =>
      GatewayJwtHeaderAdapter.assert(
        `Bearer ${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1' })).toString('base64url')}.e30.x`,
      ),
    { message: 'Access token algorithm must be ES256' },
  );
  let readinessError;
  try {
    new HealthController().ready();
  } catch (error) {
    readinessError = error;
  }
  assert.equal(readinessError?.message, 'Service Unavailable');
  assert.deepEqual(readinessError?.getResponse(), {
    message: 'Service Unavailable',
    statusCode: 503,
  });
});

test('Gateway message regressions report their file and line @spec:AC-302', () => {
  assert.deepEqual(
    errorConstructionViolations(
      'apps/gateway/src/example.ts',
      [
        "throw new Error('inline');",
        'throw new ServiceUnavailableException();',
      ].join('\n'),
    ),
    [
      {
        file: 'apps/gateway/src/example.ts',
        line: 1,
        reason: 'unnamed-message',
      },
      {
        file: 'apps/gateway/src/example.ts',
        line: 2,
        reason: 'missing-message',
      },
    ],
  );
});
