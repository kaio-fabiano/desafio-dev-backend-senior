import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');

test('AC-224: platform-nest keeps a minimal public entrypoint @spec:AC-224', async () => {
  const [packageManifest, publicApi] = await Promise.all([
    source('package.json'),
    source('libs/platform/nest/src/index.ts'),
  ]);

  assert.equal(
    JSON.parse(packageManifest).exports['./platform-nest'],
    './libs/platform/nest/src/index.ts',
  );
  assert.doesNotMatch(
    publicApi,
    /TODO|OAUTH_RESOURCE_OPTIONS|PlatformConfigModule|ResourceProvider/,
  );
});
