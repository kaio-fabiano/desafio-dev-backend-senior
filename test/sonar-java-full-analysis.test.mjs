import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('@spec:AC-194 configures complete Gradle-backed Sonar analysis', async () => {
  const buildFile = await readFile('apps/payment-federation/build.gradle.kts', 'utf8');

  assert.match(buildFile, /id\("org\.sonarqube"\)/);
  assert.match(buildFile, /jacocoTestReport/);
  assert.match(buildFile, /xml\.required = true/);
  assert.match(buildFile, /tasks\.named\("sonar"\)/);
  assert.match(buildFile, /dependsOn\(tasks\.named\("check"\), tasks\.jacocoTestReport\)/);
});
