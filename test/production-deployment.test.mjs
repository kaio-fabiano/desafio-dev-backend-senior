import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sst = await readFile(
  new URL('../infra/sst.config.ts', import.meta.url),
  'utf8',
);

test('AC-307: Gateway deploys with its public origin and a linked expiring DPoP replay table @spec:AC-307', () => {
  assert.match(
    sst,
    /new sst\.aws\.Dynamo\(['"]GatewayDpopReplay['"][\s\S]*?primaryIndex:\s*\{\s*hashKey:\s*['"]key['"]\s*\}[\s\S]*?ttl:\s*['"]expiresAt['"]/,
  );
  assert.match(sst, /GATEWAY_ORIGIN:\s*publicApi\.url/);
  assert.match(sst, /DPOP_REPLAY_TABLE:\s*gatewayDpopReplay\.name/);
  assert.match(
    sst,
    /const gateway = new sst\.aws\.Service\(['"]Gateway['"][\s\S]*?link:\s*\[[^\]]*gatewayDpopReplay[^\]]*\]/,
  );
});
