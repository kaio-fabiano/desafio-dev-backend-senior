import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-072: Critical order and payment coverage has a failing 70 percent floor @spec:AC-072', async () => {
  const [project, paymentBuild, paymentTests] = await Promise.all([
    readFile('apps/poc-harness/project.json', 'utf8'),
    readFile('apps/payment-processor/build.gradle.kts', 'utf8'),
    readFile('apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java', 'utf8'),
  ]);
  const command = JSON.parse(project).targets['milestone-7-quality'].options.command;

  assert.match(command, /--experimental-test-coverage/);
  assert.match(command, /--test-coverage-lines=70/);
  assert.match(command, /test\/milestone-3-\*\.test\.mjs/);
  assert.match(command, /gradle:8\.14\.3-jdk21 gradle --no-daemon test/);
  assert.match(paymentBuild, /tasks\.withType<Test>/);
  assert.match(paymentTests, /PaymentHandler/);
});
