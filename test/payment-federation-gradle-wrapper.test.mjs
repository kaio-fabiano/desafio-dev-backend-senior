import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const moduleRoot = resolve('apps/payment-federation');

test('Payment Federation provides a pinned Gradle Wrapper @spec:AC-294', () => {
  const properties = resolve(moduleRoot, 'gradle/wrapper/gradle-wrapper.properties');

  assert.ok(existsSync(resolve(moduleRoot, 'gradlew')));
  assert.ok(existsSync(resolve(moduleRoot, 'gradlew.bat')));
  assert.ok(existsSync(resolve(moduleRoot, 'gradle/wrapper/gradle-wrapper.jar')));
  assert.match(readFileSync(properties, 'utf8'), /gradle-8\.14\.3(?:-bin)?\.zip/);
});
