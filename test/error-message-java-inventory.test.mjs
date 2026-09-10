import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const inventoryRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/inventory';
const catalogPath = `${inventoryRoot}/domain/InventoryErrorMessages.java`;
const allowedMessageOwningExceptions = new Set([
  'Inventory.InsufficientStockException',
  'Inventory.InventoryConflictException',
  'WorkInProgressException',
]);

async function javaSources(directory = inventoryRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? javaSources(path) : [path];
    }),
  );
  return sources.flat().filter((path) => path.endsWith('.java'));
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function messageViolations(path, source, allowedNoArgument = new Set()) {
  const violations = [];
  const construction = /throw\s+new\s+([\w.]*Exception|[\w.]*BusinessRejection)\s*\(([\s\S]*?)\);/g;

  for (const match of source.matchAll(construction)) {
    const [, type, argumentsSource] = match;
    const argumentsText = argumentsSource.trim();
    const ownsMessage = allowedNoArgument.has(type);
    if (
      /["']/.test(argumentsText) ||
      (!argumentsText && !ownsMessage) ||
      (argumentsText && !ownsMessage && !argumentsText.includes('InventoryErrorMessages.'))
    ) {
      violations.push(`${path}:${lineAt(source, match.index)} throw ${type}`);
    }
  }

  for (const match of source.matchAll(/super\s*\(([\s\S]*?)\);/g)) {
    const argumentsText = match[1].trim();
    if (
      !argumentsText ||
      /["']/.test(argumentsText) ||
      !argumentsText.includes('InventoryErrorMessages.')
    ) {
      violations.push(`${path}:${lineAt(source, match.index)} exception constructor`);
    }
  }

  for (const match of source.matchAll(/Objects\.requireNonNull\([^,]+,\s*["']/g)) {
    violations.push(`${path}:${lineAt(source, match.index)} requireNonNull`);
  }

  return violations;
}

async function compileAndRun(harness) {
  const directory = await mkdtemp(join(tmpdir(), 'inventory-errors-'));
  const harnessPath = join(directory, 'InventoryErrorMessagesHarness.java');
  try {
    await writeFile(harnessPath, harness);
    await run('javac', [
      '-d',
      directory,
      catalogPath,
      `${inventoryRoot}/domain/Inventory.java`,
      `${inventoryRoot}/application/InventoryRepository.java`,
      `${inventoryRoot}/application/StockPort.java`,
      `${inventoryRoot}/application/InventoryService.java`,
      harnessPath,
    ]);
    await run('java', ['-cp', directory, 'InventoryErrorMessagesHarness']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('Java Inventory throw sites use named messages @spec:AC-299', async () => {
  const sources = (await javaSources()).filter((path) => path !== catalogPath);
  const violations = (
    await Promise.all(
      sources.map(async (path) =>
        messageViolations(
          path,
          await readFile(path, 'utf8'),
          allowedMessageOwningExceptions,
        ),
      ),
    )
  ).flat();

  assert.deepEqual(violations, []);
});

test('Java Inventory custom exceptions provide documented messages @spec:AC-300', async () => {
  await compileAndRun(`
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.domain.Inventory;

public final class InventoryErrorMessagesHarness {
    public static void main(String[] args) {
        check(InventoryErrorMessages.INSUFFICIENT_STOCK,
            new Inventory.InsufficientStockException().getMessage());
        check(InventoryErrorMessages.OPERATION_ALREADY_CLAIMED,
            new InventoryService.WorkInProgressException().getMessage());
        check(InventoryErrorMessages.inventoryConflict("42"),
            new Inventory.InventoryConflictException("42").getMessage());
    }

    private static void check(String expected, String actual) {
        if (actual == null || actual.isBlank() || !expected.equals(actual)) {
            throw new AssertionError("expected <" + expected + "> but was <" + actual + ">");
        }
    }
}
`);
});

test('Java Inventory observable error text remains compatible @spec:AC-301', async () => {
  await compileAndRun(`
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;

public final class InventoryErrorMessagesHarness {
    public static void main(String[] args) {
        check("WooCommerce stock is insufficient", InventoryErrorMessages.INSUFFICIENT_STOCK);
        check("Inventory operation is already claimed", InventoryErrorMessages.OPERATION_ALREADY_CLAIMED);
        check("WordPress service authentication failed", InventoryErrorMessages.AUTHENTICATION_FAILED);
        check("WordPress service authentication interrupted", InventoryErrorMessages.AUTHENTICATION_INTERRUPTED);
        check("inventory claim was not persisted", InventoryErrorMessages.CLAIM_NOT_PERSISTED);
        check("inventory claim ownership was lost before completion", InventoryErrorMessages.CLAIM_OWNERSHIP_LOST);
        check("inventory claim transaction failed", InventoryErrorMessages.CLAIM_TRANSACTION_FAILED);
        check("a completed inventory claim requires its event", InventoryErrorMessages.COMPLETED_CLAIM_REQUIRES_EVENT);
        check("inventory completion transaction failed", InventoryErrorMessages.COMPLETION_TRANSACTION_FAILED);
        check("currency is required", InventoryErrorMessages.CURRENCY_REQUIRED);
        check("quantity must be positive", InventoryErrorMessages.QUANTITY_MUST_BE_POSITIVE);
        check("items are required", InventoryErrorMessages.ITEMS_ARE_REQUIRED);
        check("amount must be positive", InventoryErrorMessages.AMOUNT_MUST_BE_POSITIVE);
        check("WordPress federation inventory request failed", InventoryErrorMessages.INVENTORY_REQUEST_FAILED);
        check("WooCommerce inventory request interrupted", InventoryErrorMessages.INVENTORY_REQUEST_INTERRUPTED);
        check("only the acquired inventory claim can be completed",
            InventoryErrorMessages.ONLY_ACQUIRED_CLAIM_CAN_BE_COMPLETED);
        check("operationKey identifies a different inventory request",
            InventoryErrorMessages.OPERATION_KEY_IDENTIFIES_DIFFERENT_REQUEST);
        check("an acquired inventory claim requires an owner token",
            InventoryErrorMessages.OWNER_TOKEN_REQUIRED);
        check("paymentId is required", InventoryErrorMessages.PAYMENT_ID_REQUIRED);
        check("paymentMethod is required", InventoryErrorMessages.PAYMENT_METHOD_REQUIRED);
        check("paymentOperationKey is required", InventoryErrorMessages.PAYMENT_OPERATION_KEY_REQUIRED);
        check("payerEmail is required", InventoryErrorMessages.PAYER_EMAIL_REQUIRED);
        check("productId is required", InventoryErrorMessages.PRODUCT_ID_REQUIRED);
        check("inventory request could not be serialized", InventoryErrorMessages.REQUEST_SERIALIZATION_FAILED);
        check("inventory result was not persisted", InventoryErrorMessages.RESULT_NOT_PERSISTED);
        check("traceparent is invalid", InventoryErrorMessages.TRACEPARENT_INVALID);
        check("transactionId identifies a different Inventory reservation",
            InventoryErrorMessages.TRANSACTION_ID_IDENTIFIES_DIFFERENT_RESERVATION);
        check("transactionId is required", InventoryErrorMessages.TRANSACTION_ID_REQUIRED);
        check("unsupported Inventory domain event", InventoryErrorMessages.UNSUPPORTED_DOMAIN_EVENT);
        check("inventory database is unavailable", InventoryErrorMessages.DATABASE_UNAVAILABLE);
        check("claim", InventoryErrorMessages.CLAIM);
        check("clock", InventoryErrorMessages.CLOCK);
        check("dataSource", InventoryErrorMessages.DATA_SOURCE);
        check("event", InventoryErrorMessages.EVENT);
        check("events", InventoryErrorMessages.EVENTS);
        check("eventId", InventoryErrorMessages.EVENT_ID);
        check("incomingEventId", InventoryErrorMessages.INCOMING_EVENT_ID);
        check("occurredAt", InventoryErrorMessages.OCCURRED_AT);
        check("operationKey", InventoryErrorMessages.OPERATION_KEY);
        check("repository", InventoryErrorMessages.REPOSITORY);
        check("request", InventoryErrorMessages.REQUEST);
        check("requestFingerprint", InventoryErrorMessages.REQUEST_FINGERPRINT);
        check("status", InventoryErrorMessages.STATUS);
        check("stock", InventoryErrorMessages.STOCK);
        check("views", InventoryErrorMessages.VIEWS);
        check("field is required", InventoryErrorMessages.required("field"));
        check("WooCommerce order 42 was processed by another inventory operation",
            InventoryErrorMessages.inventoryConflict("42"));
        check("WordPress federation inventory request failed: 503",
            InventoryErrorMessages.inventoryRequestFailed(503));
        check("WordPress federation did not resolve order 42",
            InventoryErrorMessages.orderNotResolved("42"));
        check("WordPress federation did not resolve product 7",
            InventoryErrorMessages.productNotResolved("7"));
        check("WordPress federation inventory query failed: 502 [down]",
            InventoryErrorMessages.inventoryQueryFailed(502, "[down]"));
        check("WordPress service authentication failed: 401",
            InventoryErrorMessages.authenticationFailed(401));
        check("unsupported Inventory integration event unknown",
            InventoryErrorMessages.unsupportedIntegrationEvent("unknown"));
    }

    private static void check(String expected, String actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("expected <" + expected + "> but was <" + actual + ">");
        }
    }
}
`);
});

test('Java Inventory regressions report file and line and fail the quality gate @spec:AC-302', () => {
  const source = `
class BrokenInventory {
    void inline() {
        throw new IllegalStateException("inline message");
    }

    void missing() {
        throw new IllegalArgumentException();
    }
}
`;

  assert.deepEqual(messageViolations('BrokenInventory.java', source), [
    'BrokenInventory.java:4 throw IllegalStateException',
    'BrokenInventory.java:8 throw IllegalArgumentException',
  ]);
});
