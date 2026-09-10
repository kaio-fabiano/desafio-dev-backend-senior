import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  assertErrorMessagePolicy,
  scanErrorMessagePolicy,
} from '../tools/error-messages/error-message-policy.mjs';

async function fixture(files) {
  const root = await mkdtemp(join(process.cwd(), '.error-message-policy-'));
  await Promise.all(
    Object.entries(files).map(async ([path, source]) => {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, source);
    }),
  );
  return root;
}

test('TypeScript throw sites use named messages @spec:AC-298', async () => {
  const root = await fixture({
    'typescript/valid.ts': 'throw new Error(ContextErrorMessages.failed);',
    'typescript/inline.ts': 'throw new Error("inline");',
    'typescript/missing.ts': 'throw new Error();',
  });
  try {
    assert.deepEqual(
      await scanErrorMessagePolicy({ root, sourceRoots: ['typescript'] }),
      [
        { file: 'typescript/inline.ts', line: 1, reason: 'inline-message' },
        { file: 'typescript/missing.ts', line: 1, reason: 'missing-message' },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Java throw sites use named messages @spec:AC-299', async () => {
  const root = await fixture({
    'java/Valid.java': 'class Valid { void fail() { throw new IllegalStateException(ContextErrorMessages.FAILED); } }',
    'java/Inline.java': 'class Inline { void fail() { throw new IllegalStateException("inline"); } }',
    'java/Missing.java': 'class Missing { void fail() { throw new IllegalStateException(); } }',
  });
  try {
    assert.deepEqual(
      await scanErrorMessagePolicy({ root, sourceRoots: ['java'] }),
      [
        { file: 'java/Inline.java', line: 1, reason: 'inline-message' },
        { file: 'java/Missing.java', line: 1, reason: 'missing-message' },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('custom exceptions provide catalog-owned default messages @spec:AC-300', async () => {
  const root = await fixture({
    'java/Broken.java': 'class Broken extends RuntimeException { Broken() { super(); } }',
    'java/Valid.java': 'class Valid extends RuntimeException { Valid() { super(ContextErrorMessages.FAILED); } }',
  });
  try {
    assert.deepEqual(
      await scanErrorMessagePolicy({ root, sourceRoots: ['java'] }),
      [{ file: 'java/Broken.java', line: 1, reason: 'missing-default-message' }],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('policy scanning preserves existing error text @spec:AC-301', async () => {
  const root = await fixture({
    'typescript/source.ts': 'throw new Error(ContextErrorMessages.compatible);',
  });
  try {
    const path = join(root, 'typescript/source.ts');
    const before = await readFile(path, 'utf8');
    assert.deepEqual(await scanErrorMessagePolicy({ root, sourceRoots: ['typescript'] }), []);
    assert.equal(await readFile(path, 'utf8'), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regressions fail with exact file and line evidence @spec:AC-302', async () => {
  const root = await fixture({
    'apps/gateway/src/broken.ts': [
      'function fail() {',
      '  throw new Error("inline");',
      '}',
      'function missing() {',
      '  throw new Error();',
      '}',
    ].join('\n'),
  });
  try {
    const violations = await scanErrorMessagePolicy({
      root,
      sourceRoots: ['apps/gateway/src'],
    });
    assert.deepEqual(violations, [
      { file: 'apps/gateway/src/broken.ts', line: 2, reason: 'inline-message' },
      { file: 'apps/gateway/src/broken.ts', line: 5, reason: 'missing-message' },
    ]);
    assert.throws(() => assertErrorMessagePolicy(violations), {
      message:
        'apps/gateway/src/broken.ts:2 inline-message\napps/gateway/src/broken.ts:5 missing-message',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
