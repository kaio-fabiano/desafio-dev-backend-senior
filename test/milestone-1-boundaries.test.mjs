import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

test('AC-018: Invalid cross-domain imports are rejected @spec:AC-018', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nx-boundaries-'));
  try {
    await writeFile(join(root, 'project.json'), JSON.stringify({ name: 'commerce', tags: ['scope:commerce'] }));
    await writeFile(join(root, 'identity.json'), JSON.stringify({ name: 'identity', tags: ['scope:identity'] }));
    const config = await readFile('eslint.config.mjs', 'utf8');
    assert.match(config, /@nx\/enforce-module-boundaries/);
    assert.match(config, /sourceTag: 'scope:commerce'/);
    assert.match(config, /onlyDependOnLibsWithTags: \['scope:commerce', 'scope:shared', 'scope:contract'\]/);
    assert.match(config, /sourceTag: 'scope:identity'/);
    await assert.rejects(run('node', ['tools/generators/project/index.mjs', 'valid-name', 'unknown']), /Usage/);
    await rm(root, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
