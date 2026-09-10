import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const roots = [
  'apps/payment-federation/src/main/java/dev/desafio/transaction/contracts',
  'apps/payment-federation/src/main/java/dev/desafio/transaction/shared',
  'apps/payment-federation/src/main/java/dev/desafio/transaction/migration',
];

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? javaSources(path) : [path];
    }),
  );
  return paths.flat().filter((path) => path.endsWith('.java'));
}

async function sources() {
  const paths = (await Promise.all(roots.map(javaSources))).flat();
  return Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(path, 'utf8') })),
  );
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function inlineMessageViolations(files) {
  const violations = [];
  const constructor = /new\s+([\w.]*Exception)\s*\(/g;

  for (const { path, source } of files) {
    const customExceptions = new Set(
      [...source.matchAll(/class\s+(\w+)\s+extends\s+[\w.]*Exception\b/g)].map(
        ([, name]) => name,
      ),
    );

    for (const match of source.matchAll(constructor)) {
      if (customExceptions.has(match[1])) continue;
      const argument = source.slice(match.index + match[0].length).trimStart();
      if (!/^\w+ErrorMessages\./.test(argument)) {
        violations.push(`${path}:${lineNumber(source, match.index)}`);
      }
    }

    for (const match of source.matchAll(/super\s*\(\s*(?:"|\))/g)) {
      violations.push(`${path}:${lineNumber(source, match.index)}`);
    }

    for (const match of source.matchAll(
      /Objects\.requireNonNull\([^,]+,\s*"/g,
    )) {
      violations.push(`${path}:${lineNumber(source, match.index)}`);
    }
  }

  return violations;
}

function customExceptionViolations(files) {
  const violations = [];

  for (const { path, source } of files) {
    for (const match of source.matchAll(
      /class\s+(\w+)\s+extends\s+[\w.]*Exception\b/g,
    )) {
      const [, name] = match;
      const classBody = source.slice(source.indexOf('{', match.index) + 1);
      const constructors = [
        ...classBody.matchAll(
          new RegExp(`\\b${name}\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
        ),
      ];

      if (constructors.length === 0) {
        violations.push(`${path}:${lineNumber(source, match.index)}`);
      }
      for (const constructor of constructors.filter(
        ([, parameters]) => !parameters.trim(),
      )) {
        const body = classBody.slice(constructor.index + constructor[0].length);
        if (!/^\s*super\s*\(\s*\w+ErrorMessages\./.test(body)) {
          violations.push(`${path}:${lineNumber(source, match.index)}`);
        }
      }
      for (const inlineSuper of classBody.matchAll(/super\s*\(\s*(?:"|\))/g)) {
        violations.push(
          `${path}:${lineNumber(source, match.index + inlineSuper.index)}`,
        );
      }
    }
  }

  return violations;
}

test('Java shared-boundary throw sites use named messages @spec:AC-299', async () => {
  assert.deepEqual(inlineMessageViolations(await sources()), []);
});

test('Java shared-boundary custom exceptions provide documented messages @spec:AC-300', async () => {
  assert.deepEqual(customExceptionViolations(await sources()), []);
});

test('Java shared-boundary observable error text remains compatible @spec:AC-301', async () => {
  const catalogs = (await sources())
    .filter(({ path }) => path.endsWith('ErrorMessages.java'))
    .map(({ source }) => source)
    .join('\n');
  const messages = [
    'eventId',
    'occurredAt',
    'payload',
    'eventType must end with .v1',
    'version must be 1',
    ' is required',
    'Legacy clean-start blocked because durable state could not be inspected',
    'Legacy clean-start blocked: ',
    'paymentMethod must be CARD or PIX',
    'Pix checkout does not accept Card provider fields',
    'Order id must be a WooCommerce global id',
    'Checkout writes are unavailable',
    'unknown context schema',
    'eventId identifies a different envelope',
    'sourceEventId identifies a different envelope',
    'inbox completion was not persisted',
    'outbox claim was lost',
    'integration event cannot be serialized',
    'outbox routing key does not match event type',
    'outbox publication failed',
    'reusable credentials are forbidden in integration events',
    'unroutable event: ',
  ];

  for (const message of messages)
    assert.ok(catalogs.includes(`"${message}"`), message);
});

test('Java shared-boundary regressions report their file and line @spec:AC-302', () => {
  const fixture = [
    {
      path: 'Example.java',
      source:
        'class Example {\n  void fail() { throw new IllegalStateException("inline"); }\n}',
    },
  ];

  assert.deepEqual(inlineMessageViolations(fixture), ['Example.java:2']);
});
