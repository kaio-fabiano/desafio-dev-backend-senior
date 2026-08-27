import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(path, 'utf8');
const [packageJson, nxJson, build, application, source, applicationTest] = await Promise.all([
  read('package.json'),
  read('nx.json'),
  read('apps/payment-processor/build.gradle.kts'),
  read('apps/payment-processor/src/main/resources/application.yaml'),
  read('apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java'),
  read('apps/payment-processor/src/test/java/dev/desafio/payment/PaymentProcessorApplicationTest.java'),
]);

test('AC-045: Payment processor is operable through Nx @spec:AC-045', () => {
  const pkg = JSON.parse(packageJson);
  const nx = JSON.parse(nxJson);
  const gradle = nx.plugins.find(({ plugin }) => plugin === '@nx/gradle/plugin');

  assert.equal(pkg.devDependencies['@nx/gradle'], '23.1.1');
  assert.deepEqual(gradle.options, { buildTargetName: 'build', testTargetName: 'test' });
  assert.match(build, /id\("org\.springframework\.boot"\) version "3\.5\.6"/);
  assert.match(build, /JavaLanguageVersion\.of\(21\)/);
  assert.match(build, /spring-boot-starter-actuator/);
  assert.match(application, /server:\n  shutdown: graceful/);
  assert.match(application, /include: health/);
  assert.match(source, /@SpringBootApplication/);
  assert.match(applicationTest, /\/actuator\/health/);
  assert.match(applicationTest, /@SpringBootTest/);
});
