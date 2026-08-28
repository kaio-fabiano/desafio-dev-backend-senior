import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const services = ['gateway', 'identity-subgraph', 'commerce-subgraph'];

test('AC-019: Production services expose health and readiness @spec:AC-019', async () => {
  const compose = await readFile('compose.yaml', 'utf8');

  for (const service of services) {
    const [controller, module] = await Promise.all([
      readFile(`apps/${service}/src/health.controller.ts`, 'utf8'),
      readFile(`apps/${service}/src/app.module.ts`, 'utf8'),
    ]);
    assert.match(controller, /Get\('health'\)/);
    assert.match(controller, /Get\('ready'\)/);
    assert.match(controller, /status: 'ok'/);
    assert.match(controller, /status: 'ready'/);
    assert.match(module, /HealthController/);
    assert.match(compose, new RegExp(`${service}:[\\s\\S]*?healthcheck:`));
  }
});
