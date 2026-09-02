import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const javaRoot = 'apps/payment-federation/src/main/java/dev/desafio';
const transactionRoot = `${javaRoot}/transaction`;

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) return javaSources(path);
        if (!entry.name.endsWith('.java')) return [];
        return [{ path, source: await readFile(path, 'utf8') }];
      }),
    )
  ).flat();
}

test('AC-170: Payment and Inventory use consistent inward layers @spec:AC-170', async () => {
  const sources = await javaSources(transactionRoot);
  const contexts = new Set();
  const violations = [];

  for (const { path, source } of sources) {
    const relative = path.slice(transactionRoot.length + 1);
    const [context] = relative.split('/');
    if (context === 'payment' || context === 'inventory') contexts.add(context);

    if (
      relative !== 'PaymentFederationApplication.java' &&
      !/^(?:payment|inventory)\/(?:domain|application|adapter|configuration)\//.test(
        relative,
      )
    ) {
      violations.push(`${relative}: source is outside a bounded-context layer`);
    }
    if (
      relative.includes('/domain/') &&
      /import (?:org\.springframework|com\.mercadopago|com\.rabbitmq|java\.sql)/.test(
        source,
      )
    ) {
      violations.push(`${relative}: domain imports an outer technology`);
    }
    if (
      relative.includes('/application/') &&
      /import (?:org\.springframework|com\.mercadopago|dev\.desafio\.transaction\.(?:payment|inventory)\.adapter)/.test(
        source,
      )
    ) {
      violations.push(`${relative}: application imports an adapter`);
    }
  }

  assert.deepEqual([...contexts].sort(), ['inventory', 'payment']);
  assert.deepEqual(violations, []);
});

test('AC-171: legacy Payment packages and direct context coupling are absent @spec:AC-171', async () => {
  const legacySources = await javaSources(`${javaRoot}/payment`);
  assert.deepEqual(legacySources, []);
  const sources = await javaSources(transactionRoot);
  const violations = [];

  for (const { path, source } of sources) {
    const relative = path.slice(transactionRoot.length + 1);
    if (/import dev\.desafio\.payment\./.test(source)) {
      violations.push(`${relative}: imports the legacy package`);
    }
    if (
      relative.startsWith('payment/') &&
      /import dev\.desafio\.transaction\.inventory\./.test(source)
    ) {
      violations.push(`${relative}: Payment imports Inventory directly`);
    }
    if (
      relative.startsWith('inventory/') &&
      /import dev\.desafio\.transaction\.payment\./.test(source)
    ) {
      violations.push(`${relative}: Inventory imports Payment directly`);
    }
  }

  assert.deepEqual(violations, []);
});

test('AC-172: migrated runtime has executable build and behavior evidence @spec:AC-172', async () => {
  const [project, migrationTest, providerTest] = await Promise.all([
    readFile('apps/payment-federation/project.json', 'utf8'),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/PaymentMigrationTest.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java',
      'utf8',
    ),
  ]);

  assert.match(project, /gradle --no-daemon test/);
  assert.match(migrationTest, /migrated Payment runtime executes Card and Pix/);
  assert.match(migrationTest, /SpringApplicationBuilder/);
  assert.match(providerTest, /@spec:AC-16[1256]/);
});

test('AC-173: payment refactor commits do not absorb identity changes @spec:AC-173', async () => {
  const { stdout } = await execFileAsync('git', [
    'log',
    '--format=%H%x00%s',
    '--name-only',
    '9394048..HEAD',
  ]);
  const commits = stdout.split(/\n(?=[0-9a-f]{40}\x00)/);
  const violations = commits.filter((commit) => {
    const [header, ...paths] = commit.trim().split('\n');
    return (
      /payment-federation-clean-architecture/.test(header) &&
      paths.some((path) => path.startsWith('libs/identity/'))
    );
  });

  assert.deepEqual(violations, []);
});
