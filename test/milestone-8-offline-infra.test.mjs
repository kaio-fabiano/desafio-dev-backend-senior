import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [config, infraTsconfig, infraPackage, ci, deploy, runbook, rootPackage] = await Promise.all([
  readFile('infra/sst.config.ts', 'utf8'),
  readFile('infra/tsconfig.json', 'utf8'),
  readFile('infra/package.json', 'utf8'),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('.github/workflows/deploy.yml', 'utf8'),
  readFile('docs/runbooks/deployment.md', 'utf8'),
  readFile('package.json', 'utf8'),
]);

test('AC-088: infrastructure validation is offline @spec:AC-088', () => {
  const infraValidate = ci.slice(ci.indexOf('infra-validate:'));
  assert.match(infraValidate, /pnpm install --ignore-workspace --lockfile=false --ignore-scripts/);
  assert.match(infraValidate, /pnpm run validate/);
  assert.match(infraPackage, /"validate"\s*:\s*"sst install --stage validation && tsc --noEmit"/);
  assert.doesNotMatch(infraValidate, /sst (diff|deploy)|pnpm run (diff|deploy)/);
  assert.doesNotMatch(ci, /configure-aws-credentials|id-token:\s*write|pnpm run diff/);
  assert.match(infraTsconfig, /"noEmit"\s*:\s*true/);
  assert.match(config, /new sst\.Secret\(/);
  assert.match(rootPackage, /"packageManager"\s*:\s*"pnpm@10\.17\.1"/);
  assert.doesNotMatch(`${ci}\n${deploy}`, /pnpm\/action-setup@v6[\s\S]{0,120}\n\s+version:/);
  assert.doesNotMatch(`${config}\n${ci}\n${deploy}`, /AKIA[0-9A-Z]{16}|AWS_SECRET_ACCESS_KEY/);
});

test('AC-088: deployment is explicit, credentialed, and protected @spec:AC-088', () => {
  assert.match(deploy, /workflow_dispatch:/);
  assert.match(deploy, /options:\s*\n\s+- production/);
  assert.match(deploy, /environment:\s*\n\s+name: production/);
  assert.match(deploy, /configure-aws-credentials@v6/);
  assert.match(deploy, /role-to-assume: \$\{\{ vars\.[A-Z0-9_]+ \}\}/);
  assert.match(deploy, /pnpm run deploy -- --stage "\$SST_STAGE"/);
  assert.match(runbook, /approved, credentialed environment/);
  assert.match(runbook, /never commit credentials/);
});
