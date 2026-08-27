import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [config, infraTsconfig, ci, deploy, runbook] = await Promise.all([
  readFile('infra/sst.config.ts', 'utf8'),
  readFile('infra/tsconfig.json', 'utf8'),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('.github/workflows/deploy.yml', 'utf8'),
  readFile('docs/runbooks/deployment.md', 'utf8'),
]);

test('AC-088: infrastructure validation is offline @spec:AC-088', () => {
  const infraValidate = ci.slice(ci.indexOf('infra-validate:'));
  assert.match(infraValidate, /pnpm exec tsc --noEmit --project tsconfig\.json/);
  assert.doesNotMatch(infraValidate, /sst (install|diff|deploy)/);
  assert.doesNotMatch(ci, /configure-aws-credentials|id-token:\s*write|pnpm run diff/);
  assert.match(infraTsconfig, /"noEmit"\s*:\s*true/);
  assert.match(config, /new sst\.Secret\(/);
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
