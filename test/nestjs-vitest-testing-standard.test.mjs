import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('AC-208: the repository defines one official NestJS testing contract @spec:AC-208', async () => {
  const standard = await source('docs/standards/nestjs-vitest-testing.md');

  for (const requiredRule of [
    /pure unit tests/i,
    /TestingModule/,
    /typed mocks/i,
    /observable behavior/i,
    /\.spec\.ts/,
    /unit.*integration.*contract.*end-to-end/is,
  ]) {
    assert.match(standard, requiredRule);
  }
  assert.match(standard, /do not use `any`/i);
  assert.match(standard, /do not test private\s+methods/i);
});

test('AC-209: every implementation task follows TDD @spec:AC-209 @principle:P-003', async () => {
  const [agents, constitution, standard] = await Promise.all([
    source('AGENTS.md'),
    source('.spec/constituicao.md'),
    source('docs/standards/nestjs-vitest-testing.md'),
  ]);

  assert.match(agents, /Red.*Green.*Refactor/is);
  assert.match(constitution, /P-003 \[DEVE\].*TDD/is);
  assert.match(standard, /expected Red failure/i);
  assert.match(standard, /Green implementation/i);
  assert.match(standard, /Refactor/i);
  assert.match(standard, /onp-spec verify/i);
  assert.match(standard, /audit --ci/i);
});

test('AC-210: Vitest coverage fails below the agreed floor @spec:AC-210', async () => {
  const [config, manifest, project] = await Promise.all([
    source('vitest.config.ts'),
    source('package.json').then(JSON.parse),
    source('libs/platform/nest/project.json').then(JSON.parse),
  ]);

  assert.equal(manifest.devDependencies['@vitest/coverage-v8'], '3.2.4');
  assert.equal(manifest.devDependencies['@nestjs/testing'], '11.1.6');
  for (const threshold of [
    /branches:\s*85/,
    /functions:\s*90/,
    /lines:\s*90/,
    /statements:\s*90/,
    /perFile:\s*true/,
  ]) {
    assert.match(config, threshold);
  }
  assert.match(project.targets.coverage.options.command, /vitest run.*--coverage/);
});

test('AC-211: every reviewed NestJS library owns fast unit-test targets @spec:AC-211', async () => {
  const project = JSON.parse(await source('libs/platform/nest/project.json'));
  const testCommands = project.targets.test.options.commands.join('\n');
  const unitCommand = project.targets.unit.options.command;
  const coverageCommand = project.targets.coverage.options.command;
  const testTypecheckCommand = project.targets['test-typecheck'].options.command;

  assert.match(unitCommand, /vitest run/);
  assert.match(unitCommand, /libs\/platform\/nest/);
  assert.match(testTypecheckCommand, /tsc -p libs\/platform\/nest\/tsconfig\.spec\.json/);
  assert.match(testCommands, /nest-provider-composition/);
  assert.doesNotMatch(
    `${unitCommand}\n${coverageCommand}`,
    /docker|testcontainers/i,
  );
});
