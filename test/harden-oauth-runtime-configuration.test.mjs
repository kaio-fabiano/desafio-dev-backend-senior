import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stack = await readFile(
  new URL('../infra/sst.config.ts', import.meta.url),
  'utf8',
);

test('production SST configures the canonical Gateway origin and a linked TTL replay table @spec:AC-310', () => {
  assert.match(
    stack,
    /new sst\.aws\.Dynamo\(['"]GatewayDpopReplay['"],[\s\S]*?ttl:\s*['"]expiresAt['"]/,
  );
  assert.match(stack, /GATEWAY_ORIGIN:\s*publicApi\.url/);
  assert.match(stack, /GATEWAY_DPOP_REPLAY_TABLE:\s*gatewayDpopReplay\.name/);
  assert.match(stack, /link:\s*\[[^\]]*gatewayDpopReplay[^\]]*\]/);
});
