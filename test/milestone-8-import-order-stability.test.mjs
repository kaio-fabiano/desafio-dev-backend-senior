import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-089: VS Code does not organize imports automatically @spec:AC-089', async () => {
  const settings = JSON.parse(await readFile('.vscode/settings.json', 'utf8'));

  assert.equal(settings['editor.codeActionsOnSave']?.['source.organizeImports'], 'never');
});
