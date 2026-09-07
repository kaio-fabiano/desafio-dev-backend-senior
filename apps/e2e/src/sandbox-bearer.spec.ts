import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  storeSecretEnvironmentValue,
  upsertEnvironmentValue,
} from './sandbox-bearer.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('sandbox bearer environment handling', () => {
  it('adds the first secret without a leading blank line @spec:AC-267 @spec:AC-268', () => {
    expect(upsertEnvironmentValue('', 'TOKEN', 'secret')).toBe(
      'TOKEN=secret\n',
    );
  });

  it('replaces one secret without changing adjacent values or exposing it in the filesystem mode @spec:AC-267 @spec:AC-268', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sandbox-environment-'));
    directories.push(directory);
    const path = join(directory, '.env');
    await writeFile(
      path,
      'SAFE=value\nMERCADO_PAGO_SANDBOX_BEARER_TOKEN=old\n',
    );

    await storeSecretEnvironmentValue(
      path,
      'MERCADO_PAGO_SANDBOX_BEARER_TOKEN',
      'new-secret',
    );

    await expect(readFile(path, 'utf8')).resolves.toBe(
      'SAFE=value\nMERCADO_PAGO_SANDBOX_BEARER_TOKEN=new-secret\n',
    );
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
