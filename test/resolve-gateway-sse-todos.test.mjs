import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// US-062 — Reuse the gateway authentication boundary for subscriptions
test('AC-130: NestJS owns the authenticated SSE route @spec:AC-130', async () => {
  const [main, appModule, middleware, handler] = await Promise.all([
    readFile('apps/gateway/src/main.ts', 'utf8'),
    readFile('apps/gateway/src/app.module.ts', 'utf8'),
    readFile('apps/gateway/src/subscriptions/sse.middleware.ts', 'utf8'),
    readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
  ]);

  assert.doesNotMatch(main, /graphql\/stream|createGatewaySseHandler/);
  assert.match(appModule, /implements NestModule/);
  assert.match(appModule, /consumer\.apply\(GatewaySseMiddleware\)\.forRoutes/);
  assert.match(appModule, /path: 'graphql\/stream'/);
  assert.match(appModule, /providers: \[GatewaySseMiddleware\]/);
  assert.match(middleware, /implements NestMiddleware/);
  assert.match(middleware, /this\.authContext\.create\(request\)/);
  assert.doesNotMatch(middleware, /verifyGatewayRequest|issuer|jwksUrl/);
  assert.match(
    handler,
    /verify: \(request: IncomingMessage\) => Promise<GatewayContext>/,
  );
  assert.match(handler, /await verify\(raw\)/);
});
