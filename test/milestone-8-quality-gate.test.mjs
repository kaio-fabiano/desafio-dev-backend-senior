import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('@spec:AC-085 quality commands use workspace and containerized tools', async () => {
  const [rootPackage, paymentProject, eslintConfig] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('apps/payment-processor/project.json', 'utf8'),
    readFile('eslint.config.mjs', 'utf8'),
  ]);

  assert.match(rootPackage, /build,typecheck,lint,test/);
  assert.doesNotMatch(paymentProject, /"command":\s*"gradle /);
  assert.match(paymentProject, /gradle:8\.14\.3-jdk21/);
  assert.match(eslintConfig, /flat\/typescript/);
});

test('@spec:AC-086 TypeScript linting enforces Nx dependency boundaries', async () => {
  const eslintConfig = await readFile('eslint.config.mjs', 'utf8');
  assert.match(eslintConfig, /@nx\/enforce-module-boundaries/);
  assert.match(eslintConfig, /scope:contract/);
  assert.match(eslintConfig, /scope:shared/);
});
