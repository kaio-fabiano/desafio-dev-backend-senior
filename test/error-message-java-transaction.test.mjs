import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(
  'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction',
);

async function javaSources(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? javaSources(target)
        : entry.name.endsWith('.java')
          ? readFile(target, 'utf8').then((source) => ({ target, source }))
          : [];
    }),
  );
  return files.flat();
}

function customExceptions(sources) {
  return new Set(
    sources.flatMap(({ source }) =>
      [...source.matchAll(/class\s+(\w+)\s+extends\s+(?:Runtime)?Exception\s*\{/g)]
        .filter(({ index }) =>
          source
            .slice(index, index + 600)
            .includes('super(TransactionErrorMessages.'),
        )
        .map((match) => match[1]),
    ),
  );
}

function throwViolations(target, source, namedCustomExceptions = new Set()) {
  return [...source.matchAll(/throw\s+new\s+([\w.]+)\s*\(([\s\S]*?)\);/g)]
    .filter((match) => {
      const exception = match[1].split('.').at(-1);
      const argumentsSource = match[2].trim();
      return !argumentsSource.startsWith('TransactionErrorMessages.')
        && !namedCustomExceptions.has(exception);
    })
    .map((match) => {
      const line = source.slice(0, match.index).split('\n').length;
      return `${path.relative(process.cwd(), target)}:${line}`;
    });
}

test('@spec:AC-299 Java Transaction throw sites use named messages', async () => {
  const sources = await javaSources();
  const violations = sources.flatMap(({ target, source }) =>
    throwViolations(target, source, customExceptions(sources)),
  );

  assert.deepEqual(violations, []);
});

test('@spec:AC-300 Java Transaction custom exceptions provide documented messages', async () => {
  const sources = await javaSources();
  const violations = sources.flatMap(({ target, source }) =>
    [...source.matchAll(/class\s+(\w+)\s+extends\s+(?:Runtime)?Exception\s*\{/g)]
      .filter(({ index }) =>
        !source
          .slice(index, index + 600)
          .includes('super(TransactionErrorMessages.'),
      )
      .map((match) => `${path.relative(process.cwd(), target)}:${source.slice(0, match.index).split('\n').length}`),
  );

  assert.deepEqual(violations, []);
});

test('@spec:AC-301 Java Transaction observable error text remains compatible', async () => {
  const catalog = await readFile(path.join(root, 'domain/TransactionErrorMessages.java'), 'utf8');
  const messages = [
    'Checkout creation did not complete before the bounded wait expired',
    'The operation key is already bound to a different checkout command',
    'WooCommerce checkout result is ambiguous and must be reconciled',
    'transaction event history is required',
    'event belongs to another transaction',
    'transaction event version is not contiguous',
    'transaction identity and checkout facts are immutable',
    'items are required',
    'amount must be positive',
    'currency must be ISO-4217',
    'paymentMethod must be CARD or PIX',
    'quantity must be positive',
    'only the initial event omits outcome metadata',
    'outcome events require outcome metadata',
    'version must be positive',
    'exactly one transaction selector is required',
    'transactionId is required',
    'checkout command cannot be hashed',
    'Woo order id is required',
    'Woo order items are required',
    'Pix checkout does not accept Card provider fields',
    'checkout claim transaction failed',
    'checkout database is unavailable',
    'checkout lease was lost',
    'Woo order confirmation could not be persisted',
    'completed checkout could not be read',
    'checkout lease could not be released',
    'checkout operation was not persisted',
    'checkout operation could not be updated',
    'checkout items cannot be serialized',
    'stored checkout items are invalid',
    'WooCommerce checkout failed',
    'transactionId identifies a different checkout',
    'reference is required',
    'WooGraphQL service login failed',
    'WooCommerce orders are invalid',
    'WooCommerce operation reference is not unique',
    'WooCommerce cart is missing',
    'Stored Woo order id is invalid',
    'WooCommerce items are invalid',
    'WooCommerce amount is invalid',
    'WooGraphQL returned errors',
  ];

  for (const message of messages) assert.match(catalog, new RegExp(JSON.stringify(message)));
  assert.match(catalog, /return name \+ " is required";/);
  assert.match(catalog, /return outcome \+ " is not ready while Transaction is " \+ status;/);
  assert.match(catalog, /return "Transaction does not consume " \+ eventType;/);
  assert.match(catalog, /return "WooGraphQL request failed: " \+ statusCode;/);
});

test('@spec:AC-302 Java Transaction regressions report file and line and fail', () => {
  const target = path.join(root, 'Example.java');
  const violations = throwViolations(
    target,
    'class Example {\n  void fail() {\n    throw new IllegalStateException("inline");\n    throw new IllegalStateException();\n  }\n}',
  );

  assert.deepEqual(violations, [
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/Example.java:3',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/Example.java:4',
  ]);
});
