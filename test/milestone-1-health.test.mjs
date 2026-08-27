import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { spawn } from 'node:child_process';

const services = [
  'apps/gateway/src/main.ts',
  'apps/identity-subgraph/src/main.ts',
  'apps/commerce-subgraph/src/main.ts',
];

async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function request(url) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}

test('AC-019: Skeleton services report health and readiness @spec:AC-019', async () => {
  for (const entrypoint of services) {
    const port = await availablePort();
    const service = spawn(process.execPath, ['--experimental-transform-types', entrypoint], {
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    });

    try {
      const health = await request(`http://127.0.0.1:${port}/health`);
      assert.equal(health.status, 200, `${entrypoint} health endpoint`);
      assert.deepEqual(await health.json(), { status: 'ok' });

      const readiness = await request(`http://127.0.0.1:${port}/ready`);
      assert.equal(readiness.status, 200, `${entrypoint} readiness endpoint`);
      assert.deepEqual(await readiness.json(), { status: 'ready' });
    } finally {
      service.kill();
      await once(service, 'exit');
    }
  }
});
