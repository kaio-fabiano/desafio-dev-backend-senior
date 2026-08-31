import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const applications = ['gateway', 'identity-subgraph', 'wordpress-federation'];

test('AC-107: active TypeScript applications pass explicit Nx typecheck targets @spec:AC-107', async () => {
  for (const application of applications) {
    const project = JSON.parse(
      await readFile(`apps/${application}/project.json`, 'utf8'),
    );
    assert.equal(
      project.targets?.typecheck?.options?.command,
      `tsc -p apps/${application}/tsconfig.app.json --noEmit`,
    );
    await readFile(`apps/${application}/tsconfig.app.json`, 'utf8');
  }

  execFileSync(
    './node_modules/.bin/nx',
    [
      'run-many',
      '-t',
      'typecheck',
      `--projects=${applications.join(',')}`,
      '--outputStyle=static',
      '--skip-nx-cache',
    ],
    { stdio: 'pipe' },
  );
});

test('AC-108: TypeScript import organization stays disabled in language scopes @spec:AC-108', async () => {
  const settings = JSON.parse(await readFile('.vscode/settings.json', 'utf8'));

  for (const language of ['[typescript]', '[typescriptreact]']) {
    assert.deepEqual(
      settings[language]?.['editor.codeActionsOnSave']?.['source.organizeImports'],
      'never',
      `${language} must explicitly disable organize imports`,
    );
  }
});
