import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-072: Critical order and payment coverage has a failing 70 percent floor @spec:AC-072', async () => {
  const [project, paymentBuild, paymentTests] = await Promise.all([
    readFile('apps/e2e/project.json', 'utf8'),
    readFile('apps/payment-federation/build.gradle.kts', 'utf8'),
    readFile('apps/payment-federation/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java', 'utf8'),
  ]);
  const command = JSON.parse(project).targets['milestone-7-quality'].options.command;

  assert.match(command, /--experimental-test-coverage/);
  assert.match(command, /--test-coverage-lines=70/);
  assert.match(command, /test\/milestone-7-coverage\.test\.mjs/);
  assert.match(command, /gradle:9\.7\.1-jdk26-ubi gradle --no-daemon test/);
  assert.match(paymentBuild, /tasks\.withType<Test>/);
  assert.match(paymentTests, /PaymentHandler/);
});
