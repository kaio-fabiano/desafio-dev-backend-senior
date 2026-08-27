import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const matrix = await readFile('docs/evidence/milestone-7/requirements.md', 'utf8');
const criteria = Array.from(matrix.matchAll(/\| (AC-\d{3}) \|([^\n]+)\|([^\n]+)\|/g));
const required = Array.from({ length: 11 }, (_, index) => `AC-${String(index + 67).padStart(3, '0')}`);

test('AC-067..AC-077: Every mandatory criterion is traced @spec:AC-067 @spec:AC-068 @spec:AC-069 @spec:AC-070 @spec:AC-071 @spec:AC-072 @spec:AC-073 @spec:AC-074 @spec:AC-075 @spec:AC-076 @spec:AC-077', () => {
  assert.deepEqual(criteria.map(([id]) => id), required);
  for (const [, requirement, evidence] of criteria) {
    assert.ok(requirement.trim().length > 20, 'requirement description must be substantive');
    assert.match(evidence, /\[[^\]]+\]\([^)]+\)/, 'criterion must link evidence');
  }
});

test('AC-077: Matrix distinguishes mandatory gates from optional observability @spec:AC-077', () => {
  assert.match(matrix, /AC-067 through AC-077 are mandatory/);
  assert.match(matrix, /OpenTelemetry is an optional bonus/);
  assert.doesNotMatch(matrix, /OpenTelemetry.*mandatory/i);
});
