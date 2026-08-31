import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [config, infraPackage, ci, deploy] = await Promise.all([
  readFile('infra/sst.config.ts', 'utf8'),
  readFile('infra/package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
  readFile('.github/workflows/deploy.yml', 'utf8'),
]);

test('AC-076: SST v3 and its AWS provider are pinned exactly @spec:AC-076', () => {
  assert.match(infraPackage.devDependencies.sst, /^3\.\d+\.\d+$/);
  assert.doesNotMatch(infraPackage.devDependencies.sst, /[~^*xX><=|]/);
  assert.match(config, new RegExp(`version: ["']${infraPackage.devDependencies.sst}["']`));
  assert.match(config, /providers:[\s\S]*aws:[\s\S]*version: ["']\d+\.\d+\.\d+["']/);
  assert.equal(infraPackage.scripts.validate, 'sst install --stage validation && tsc --noEmit');
  assert.equal(infraPackage.scripts.diff, 'sst diff');
});

test('AC-076: the stack models protected application resources without inline secrets @spec:AC-076', () => {
  assert.match(config, /home: ["']aws["']/);
  assert.match(config, /protect: production/);
  assert.match(config, /production \? ["']retain-all["'] : ["']remove["']/);
  assert.match(config, /new sst\.aws\.Vpc\(/);
  assert.match(config, /new sst\.aws\.Cluster\(/);
  assert.equal((config.match(/new sst\.aws\.Postgres\(/g) ?? []).length, 1);
  assert.ok((config.match(/new sst\.aws\.Service\(/g) ?? []).length >= 6);
  assert.ok((config.match(/new sst\.Secret\(/g) ?? []).length >= 2);
  assert.match(config, /wordpress:6\.8\.2-php8\.3-apache/);

  const deliveryFiles = `${config}\n${ci}\n${deploy}`;
  assert.doesNotMatch(deliveryFiles, /AKIA[0-9A-Z]{16}/);
  assert.doesNotMatch(deliveryFiles, /secrets\.(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)/);
});

test('AC-076: CI validates offline and deploy remains manual, OIDC credentialed, and environment gated @spec:AC-076', () => {
  assert.match(ci, /infra-validate:/);
  assert.match(ci, /pnpm install --ignore-workspace --lockfile=false --ignore-scripts/);
  assert.match(ci, /pnpm run validate/);
  assert.doesNotMatch(ci, /dangerouslyAllowAllBuilds/);
  assert.doesNotMatch(ci, /infra-diff:|configure-aws-credentials|sst (?:diff|deploy)|pnpm run (?:diff|deploy)/);

  assert.match(deploy, /workflow_dispatch:/);
  assert.match(deploy, /environment:\s*\n\s+name: production/);
  assert.match(deploy, /configure-aws-credentials@v6/);
  assert.match(deploy, /role-to-assume: \$\{\{ vars\./);
  assert.match(deploy, /pnpm install --lockfile=false --ignore-scripts/);
  assert.match(deploy, /pnpm run deploy -- --stage ["']\$SST_STAGE["']/);
  assert.doesNotMatch(deploy, /pull_request:|push:/);
});
