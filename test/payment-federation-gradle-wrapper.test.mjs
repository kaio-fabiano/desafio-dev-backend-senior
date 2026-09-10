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
  assert.match(readFileSync(properties, 'utf8'), /gradle-9\.7\.1(?:-bin)?\.zip/);
});

test('Payment Federation build surfaces use Java 26 and Gradle 9.7.1 @spec:AC-295', () => {
  const build = readFileSync(resolve(moduleRoot, 'build.gradle.kts'), 'utf8');
  const dockerfile = readFileSync(resolve(moduleRoot, 'Dockerfile'), 'utf8');
  const project = readFileSync(resolve(moduleRoot, 'project.json'), 'utf8');
  const e2eProject = readFileSync(resolve('apps/e2e/project.json'), 'utf8');

  assert.match(build, /JavaLanguageVersion\.of\(26\)/);
  assert.match(dockerfile, /gradle:9\.7\.1-jdk26-ubi/);
  assert.match(dockerfile, /eclipse-temurin:26.*-jre/);
  assert.match(project, /gradle:9\.7\.1-jdk26-ubi/g);
  assert.match(e2eProject, /gradle:9\.7\.1-jdk26-ubi/);
});
