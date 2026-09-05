import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const inventoryPath = resolve(
  workspaceRoot,
  '.spec/features/resolve-node-review-todos/inventory.json',
);

async function exists(path) {
  return access(path).then(
    () => true,
    () => false,
  );
}

test('@spec:AC-232 records a verifiable disposition for every original Node review marker', async () => {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));

  assert.equal(inventory.length, 226);

  const incomplete = [];
  for (const finding of inventory) {
    const disposition = finding.disposition;
    if (
      finding.status !== 'resolved' ||
      !finding.marker ||
      !disposition ||
      !Array.isArray(disposition.actualOwners) ||
      disposition.actualOwners.length === 0 ||
      !Array.isArray(disposition.evidence) ||
      disposition.evidence.length === 0 ||
      !Array.isArray(disposition.tests) ||
      disposition.tests.length === 0
    ) {
      incomplete.push(finding.id);
      continue;
    }

    const missingOwners = [];
    for (const owner of disposition.actualOwners) {
      if (!(await exists(resolve(workspaceRoot, owner)))) {
        missingOwners.push(owner);
      }
    }
    if (missingOwners.length > 0) {
      incomplete.push(
        `${finding.id} (missing owner: ${missingOwners.join(', ')})`,
      );
      continue;
    }

    const references = [...disposition.evidence, ...disposition.tests];
    const missingReferences = [];
    for (const reference of references) {
      if (!(await exists(resolve(workspaceRoot, reference)))) {
        missingReferences.push(reference);
      }
    }
    if (missingReferences.length > 0) {
      incomplete.push(
        `${finding.id} (missing evidence: ${missingReferences.join(', ')})`,
      );
      continue;
    }

    if (await exists(resolve(workspaceRoot, finding.file))) {
      const source = await readFile(
        resolve(workspaceRoot, finding.file),
        'utf8',
      );
      if (source.includes(finding.marker)) {
        incomplete.push(`${finding.id} (original marker remains)`);
      }
    }
  }

  assert.deepEqual(incomplete, []);
});
