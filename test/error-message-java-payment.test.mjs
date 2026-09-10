import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const paymentRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/payment';
const catalogPath = `${paymentRoot}/domain/PaymentErrorMessages.java`;

async function javaSources() {
  const paths = (await readdir(paymentRoot, { recursive: true }))
    .filter((path) => path.endsWith('.java'))
    .map((path) => join(paymentRoot, path))
    .sort();
  return Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(path, 'utf8') })),
  );
}

function closingDelimiter(source, start, opening, closing) {
  let depth = 1;
  let quote;

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === opening) {
      depth += 1;
    } else if (character === closing && --depth === 0) {
      return index;
    }
  }
  return -1;
}

function withoutComments(source) {
  let clean = '';
  let quote;
  let blockComment = false;
  let lineComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      lineComment = character !== '\n';
      clean += character === '\n' ? '\n' : ' ';
    } else if (blockComment) {
      if (character === '*' && next === '/') {
        clean += '  ';
        blockComment = false;
        index += 1;
      } else {
        clean += character === '\n' ? '\n' : ' ';
      }
    } else if (quote) {
      clean += character;
      if (character === '\\') clean += source[++index];
      else if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
      clean += character;
    } else if (character === '/' && next === '/') {
      clean += '  ';
      lineComment = true;
      index += 1;
    } else if (character === '/' && next === '*') {
      clean += '  ';
      blockComment = true;
      index += 1;
    } else {
      clean += character;
    }
  }
  return clean;
}

function exceptionConstructions(source) {
  source = withoutComments(source);
  const constructions = [];
  const pattern = /throw\s+new\s+([\w.]+(?:Exception|Error))\s*\(/g;

  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf('(');
    const close = closingDelimiter(source, open, '(', ')');
    constructions.push({
      exception: match[1],
      arguments: close < 0 ? '' : source.slice(open + 1, close).trim(),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return constructions;
}

function messageViolations(path, source) {
  return exceptionConstructions(source)
    .filter(
      ({ exception, arguments: constructorArguments }) =>
        !constructorArguments.startsWith('PaymentErrorMessages.') &&
        !(
          exception.endsWith('MPInvalidWebhookSignatureException') &&
          constructorArguments.startsWith(
            'com.mercadopago.exceptions.SignatureFailureReason.',
          )
        ),
    )
    .map(({ line }) => `${relative('.', path)}:${line}`);
}

function customExceptionViolations(path, source) {
  source = withoutComments(source);
  const violations = [];
  const declaration =
    /\bclass\s+(\w+(?:Exception|Error))\s+extends\s+[\w.]+(?:Exception|Error)\s*\{/g;

  for (const match of source.matchAll(declaration)) {
    const open = match.index + match[0].lastIndexOf('{');
    const close = closingDelimiter(source, open, '{', '}');
    const body = close < 0 ? '' : source.slice(open + 1, close);
    const constructors = [
      ...body.matchAll(
        new RegExp(`\\b${match[1]}\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
      ),
    ];
    const noArgumentConstructors = constructors.filter(
      ([, parameters]) => parameters.trim() === '',
    );
    if (
      constructors.length === 0 ||
      noArgumentConstructors.some((constructor) => {
        const constructorOpen =
          open + 1 + constructor.index + constructor[0].lastIndexOf('{');
        const constructorClose = closingDelimiter(
          source,
          constructorOpen,
          '{',
          '}',
        );
        return !source
          .slice(constructorOpen + 1, constructorClose)
          .includes('super(PaymentErrorMessages.');
      })
    ) {
      violations.push(
        `${relative('.', path)}:${source.slice(0, match.index).split('\n').length}`,
      );
    }
  }
  return violations;
}

test('AC-299: Java Payment throw sites use named messages @spec:AC-299', async () => {
  const sources = await javaSources();
  const violations = sources.flatMap(({ path, source }) =>
    messageViolations(path, source),
  );

  assert.ok(sources.length > 0);
  assert.deepEqual(violations, []);
});

test('AC-300: Java Payment custom exceptions provide documented messages @spec:AC-300', async () => {
  const sources = await javaSources();
  const violations = sources.flatMap(({ path, source }) =>
    customExceptionViolations(path, source),
  );
  const badFixture = `
    class MissingMessageException extends RuntimeException {}
    class EmptyMessageException extends RuntimeException {
      EmptyMessageException() { super(); }
    }
  `;

  assert.equal(customExceptionViolations('Fixture.java', badFixture).length, 2);
  assert.deepEqual(violations, []);
});

test('AC-301: Java Payment observable error text remains compatible @spec:AC-301', async () => {
  const catalog = await readFile(catalogPath, 'utf8');
  const expectedConstants = {
    AMOUNT_MUST_BE_POSITIVE: 'amount must be positive',
    AUTHORIZED_PAYMENT_DOES_NOT_EXIST: 'authorized payment does not exist',
    AUTHORIZED_PAYMENT_DOES_NOT_MATCH_REFUND_REQUEST:
      'authorized payment does not match the refund request',
    AXON_NOTIFICATION_CLAIMS_ARE_NOT_SUPPORTED:
      'Axon notification claims are not supported',
    AXON_NOTIFICATION_COMPLETION_IS_NOT_SUPPORTED:
      'Axon notification completion is not supported',
    CARD_PAYMENTS_CANNOT_HAVE_PIX_STATUS:
      'Card payments cannot have Pix status',
    CLAIMED_PAYMENT_INBOX_RECORD_IS_INCOMPLETE:
      'claimed payment inbox record is incomplete',
    CLAIMED_PAYMENT_INBOX_RECORD_IS_MISSING:
      'claimed payment inbox record is missing',
    CLAIMED_PAYMENT_RESULT_IS_INCOMPLETE:
      'claimed payment result is incomplete',
    CURRENCY_MUST_BE_ISO_4217: 'currency must be ISO-4217',
    EFFECT_ID_IDENTIFIES_CONFLICTING_PAYMENT_INTENT:
      'effectId identifies a conflicting payment intent',
    MERCADO_PAGO_PAYMENT_CREATION_FAILED:
      'Mercado Pago payment creation failed',
    MERCADO_PAGO_PAYMENT_LOOKUP_FAILED: 'Mercado Pago payment lookup failed',
    MERCADO_PAGO_PAYMENT_REFUND_FAILED: 'Mercado Pago payment refund failed',
    MERCADO_PAGO_PAYMENTS_REQUIRE_BRL: 'Mercado Pago payments require BRL',
    MERCADO_PAGO_RETURNED_NO_PAYMENT_REFERENCE:
      'Mercado Pago returned no payment reference',
    ONLY_AN_AUTHORIZED_CARD_PAYMENT_CAN_BE_REFUNDED:
      'only an authorized Card payment can be refunded',
    ONLY_GENERATED_PIX_PAYMENTS_HAVE_A_PIX_CODE:
      'only generated Pix payments have a Pix code',
    ONLY_GENERATED_PIX_RESULTS_HAVE_A_PIX_CODE:
      'only generated Pix results have a Pix code',
    OPERATION_KEY_AND_PAYMENT_ID_IDENTIFY_A_DIFFERENT_PAYMENT:
      'operationKey and paymentId identify a different payment',
    PAYMENT_DATABASE_IS_UNAVAILABLE: 'payment database is unavailable',
    PAYMENT_EFFECT_CLAIM_IS_MISSING: 'payment effect claim is missing',
    PAYMENT_EFFECT_COMPLETED_WITH_ANOTHER_RESULT:
      'payment effect completed with another result',
    PAYMENT_ID_AND_OPERATION_KEY_IDENTIFY_DIFFERENT_PAYMENTS:
      'paymentId and operationKey identify different payments',
    PAYMENT_ID_DOES_NOT_MATCH: 'paymentId does not match',
    PAYMENT_IDENTIFIERS_IDENTIFY_A_CONFLICTING_INTENT:
      'payment identifiers identify a conflicting intent',
    PAYMENT_INBOX_RECORD_WAS_NOT_COMPLETED:
      'payment inbox record was not completed',
    PAYMENT_OUTBOX_EVENT_WAS_NOT_PERSISTED:
      'payment outbox event was not persisted',
    PAYMENT_PROJECTION_HAS_NO_REQUESTED_EVENT:
      'Payment projection has no requested event',
    PAYMENT_PROVIDER_MODE_MUST_BE_MERCADO_PAGO:
      'payment.provider.mode must be mercado-pago',
    PAYMENT_STATE_CHANGED_WHILE_PROCESSING_PROVIDER_NOTIFICATION:
      'payment state changed while processing provider notification',
    PAYMENT_STATE_CHANGED_WHILE_PROCESSING_PROVIDER_RESULT:
      'payment state changed while processing provider result',
    PAYMENT_TRANSACTION_FAILED: 'payment transaction failed',
    PAYMENT_WAS_NOT_PERSISTED: 'payment was not persisted',
    PENDING_PAYMENTS_DO_NOT_EMIT_RESULT_EVENTS:
      'pending payments do not emit result events',
    PENDING_PAYMENTS_HAVE_NO_EFFECT: 'pending payments have no effect',
    PIX_PAYMENTS_CANNOT_HAVE_CARD_STATUS:
      'Pix payments cannot have Card status',
    PIX_PAYMENTS_DO_NOT_ACCEPT_CARD_PROVIDER_FIELDS:
      'Pix payments do not accept Card provider fields',
    PROVIDER_LOOKUP_IS_UNAVAILABLE: 'provider lookup is unavailable',
    PROVIDER_NOTIFICATION_CLAIM_FAILED: 'provider notification claim failed',
    PROVIDER_NOTIFICATION_CLAIM_IS_MISSING:
      'provider notification claim is missing',
    PROVIDER_NOTIFICATION_COMPLETION_FAILED:
      'provider notification completion failed',
    PROVIDER_NOTIFICATION_DOES_NOT_MATCH_A_STORED_PAYMENT:
      'provider notification does not match a stored payment',
    PROVIDER_NOTIFICATION_INBOX_RECORD_WAS_NOT_COMPLETED:
      'provider notification inbox record was not completed',
    PROVIDER_NOTIFICATION_RESOLVED_TO_A_DIFFERENT_PAYMENT:
      'provider notification resolved to a different payment',
    PROVIDER_NOTIFICATION_TRANSACTION_FAILED:
      'provider notification transaction failed',
    PROVIDER_PAYMENT_IS_NOT_YET_VISIBLE: 'provider payment is not yet visible',
    PROVIDER_RECONCILIATION_IS_UNAVAILABLE:
      'provider reconciliation is unavailable',
    PROVIDER_REFERENCE_MATCHES_MORE_THAN_ONE_PAYMENT:
      'provider reference matches more than one payment',
    PROVIDER_REFERENCE_MUST_BE_A_MERCADO_PAGO_PAYMENT_ID:
      'providerReference must be a Mercado Pago payment id',
    PROVIDER_RESULT_IS_INCOMPATIBLE_WITH_PAYMENT_REQUEST:
      'provider result is incompatible with the payment request',
    REFUND_IDENTIFIERS_DO_NOT_MATCH_AUTHORIZED_PAYMENT:
      'refund identifiers do not match the authorized payment',
    REFUND_IDENTIFIERS_DO_NOT_MATCH_PAYMENT:
      'refund identifiers do not match the payment',
    REFUND_MUST_PRESERVE_APPROVED_PROVIDER_REFERENCE:
      'refund must preserve the approved provider reference',
    REFUND_REQUIRES_APPROVED_CARD_PAYMENT:
      'refund requires an approved Card payment',
    REFUND_REQUIRES_APPROVED_PAYMENT: 'refund requires an approved payment',
    REFUND_RESULT_DOES_NOT_MATCH_AUTHORIZED_PAYMENT:
      'refund result does not match the authorized payment',
    STATUS_DOES_NOT_PRODUCE_A_PAYMENT_EFFECT:
      'status does not produce a payment effect',
    STATUS_DOES_NOT_PRODUCE_A_PAYMENT_EVENT:
      'status does not produce a payment event',
    TERMINAL_PAYMENT_STATE_CANNOT_CHANGE:
      'terminal payment state cannot change',
    UNSUPPORTED_MERCADO_PAGO_PAYMENT_STATUS:
      'Unsupported Mercado Pago payment status',
    UNSUPPORTED_PAYMENT_OUTBOX_EVENT: 'unsupported payment outbox event',
    WORDPRESS_FEDERATION_PAYMENT_UPDATE_FAILED:
      'WordPress federation payment update failed',
    WORDPRESS_FEDERATION_PAYMENT_UPDATE_INTERRUPTED:
      'WordPress federation payment update interrupted',
    WORDPRESS_SERVICE_AUTHENTICATION_FAILED:
      'WordPress service authentication failed',
    WORDPRESS_SERVICE_AUTHENTICATION_INTERRUPTED:
      'WordPress service authentication interrupted',
  };
  const constants = Object.fromEntries(
    [
      ...catalog.matchAll(/public static final String (\w+)\s*=\s*"([^"]*)";/g),
    ].map(([, name, value]) => [name, value]),
  );

  for (const [name, value] of Object.entries(expectedConstants)) {
    assert.equal(constants[name], value, name);
  }
  assert.match(catalog, /return field \+ " is required";/);
  assert.match(catalog, /return "unsupported payment event: " \+ eventType;/);
  assert.match(catalog, /return "Payment does not consume " \+ eventType;/);
  assert.match(
    catalog,
    /return WORDPRESS_SERVICE_AUTHENTICATION_FAILED \+ ": " \+ statusCode;/,
  );
  assert.match(
    catalog,
    /return WORDPRESS_FEDERATION_PAYMENT_UPDATE_FAILED \+ ": " \+ statusCode;/,
  );
  assert.match(catalog, /return property \+ " must be " \+ expected;/);
  assert.match(catalog, /return property \+ " must be between 1ms and 60s";/);
});

test('AC-302: Java Payment message regressions report their file and line @spec:AC-302', async () => {
  const fixture = `class Fixture {
    // throw new IllegalStateException("documentation only");
    void inline() { throw new IllegalStateException("inline"); }
    void missing() { throw new IllegalStateException(); }
  }`;

  assert.deepEqual(messageViolations('Fixture.java', fixture), [
    'Fixture.java:3',
    'Fixture.java:4',
  ]);

  const sources = await javaSources();
  assert.deepEqual(
    sources.flatMap(({ path, source }) => messageViolations(path, source)),
    [],
  );
});
