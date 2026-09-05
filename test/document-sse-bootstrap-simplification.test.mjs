import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('@spec:AC-201 resolved SSE startup and lifecycle evidence remains discoverable', async () => {
  const [main, module, middleware, integration] = await Promise.all([
    source('../apps/order-workflow-subgraph/src/main.ts'),
    source(
      '../apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
    ),
    source('../apps/order-workflow-subgraph/src/graphql/sse/sse.middleware.ts'),
    source(
      '../apps/order-workflow-subgraph/src/graphql/sse/sse.integration.spec.ts',
    ),
  ]);

  assert.doesNotMatch(
    main,
    /registerDeferredSseRoute|TODO: Register the SSE handler/,
  );
  assert.match(module, /consumer\.apply\(OrderWorkflowSseMiddleware\)/);
  assert.match(module, /path: 'graphql\/stream'/);
  assert.match(module, /stopOnApplicationShutdown: true/);
  assert.match(middleware, /OrderWorkflowSseConnections/);
  assert.match(integration, /@spec:AC-201/);
  assert.match(integration, /createClient/);
  assert.match(integration, /await running\.app\.close\(\)/);
});

function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}
