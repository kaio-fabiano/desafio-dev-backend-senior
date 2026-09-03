import { createHash, createHmac, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CONFIRMATION = 'CREATE_AND_REFUND_TEST_PAYMENTS';
const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com';

type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PIX_GENERATED'
  | 'REFUNDED'
  | 'REJECTED';

export type SandboxPayment = {
  id: string;
  operationKey: string;
  status: PaymentStatus;
  providerReference: string;
  pixCode?: string | null;
};

type PaymentInput = {
  operationKey: string;
  paymentId: string;
  orderId: string;
  method: 'CARD' | 'PIX';
  amount: number;
  currency: 'BRL';
  payerEmail: string;
  providerToken?: string;
  paymentMethodId?: string;
};

export type ProviderPayment = {
  id: string;
  status: string;
  externalReference?: string;
  operationKey?: string;
  refundIds: string[];
};

export interface SandboxDriver {
  authorize(input: PaymentInput): Promise<SandboxPayment>;
  readPayment(paymentId: string): Promise<SandboxPayment>;
  findProviderPayments(
    paymentId: string,
    operationKey: string,
  ): Promise<ProviderPayment[]>;
  refund(providerReference: string, operationKey: string): Promise<void>;
  readProviderPayment(providerReference: string): Promise<ProviderPayment>;
  notify(
    providerReference: string,
    requestId: string,
    signature: string,
  ): Promise<number>;
}

export type SandboxConfig = {
  accessToken: string;
  bearerToken: string;
  cardToken: string;
  graphqlUrl: string;
  webhookUrl: string;
  webhookSecret: string;
  payerEmail: string;
  paymentMethodId: string;
  amount: number;
};

export type EvidenceRecord = {
  timestamp: string;
  operationKey: string;
  sanitizedReference: string;
  status: string;
  exitResult: 0;
};

export type SandboxEvidence = { records: EvidenceRecord[] };

export function sandboxConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): SandboxConfig {
  if (environment.MERCADO_PAGO_SANDBOX_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `MERCADO_PAGO_SANDBOX_CONFIRM must equal ${CONFIRMATION}`,
    );
  }

  const amount = Number(required(environment, 'MERCADO_PAGO_SANDBOX_AMOUNT'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('MERCADO_PAGO_SANDBOX_AMOUNT must be a positive number');
  }

  return {
    accessToken: required(environment, 'MERCADO_PAGO_ACCESS_TOKEN'),
    bearerToken: required(environment, 'MERCADO_PAGO_SANDBOX_BEARER_TOKEN'),
    cardToken: required(environment, 'MERCADO_PAGO_SANDBOX_CARD_TOKEN'),
    graphqlUrl: httpsUrl(environment, 'MERCADO_PAGO_SANDBOX_GRAPHQL_URL'),
    webhookUrl: httpsUrl(environment, 'MERCADO_PAGO_SANDBOX_WEBHOOK_URL'),
    webhookSecret: required(environment, 'MERCADO_PAGO_WEBHOOK_SECRET'),
    payerEmail: required(environment, 'MERCADO_PAGO_SANDBOX_PAYER_EMAIL'),
    paymentMethodId: required(
      environment,
      'MERCADO_PAGO_SANDBOX_PAYMENT_METHOD_ID',
    ),
    amount,
  };
}

export async function verifyMercadoPagoSandbox(
  config: SandboxConfig,
  driver: SandboxDriver = new HttpSandboxDriver(config),
  operationId: () => string = randomUUID,
): Promise<SandboxEvidence> {
  const cardKey = operationKey('card', operationId());
  const pixKey = operationKey('pix', operationId());
  const refundKey = operationKey('refund', operationId());
  const cardInput: PaymentInput = {
    operationKey: cardKey,
    paymentId: `payment-${cardKey}`,
    orderId: `order-${cardKey}`,
    method: 'CARD',
    amount: config.amount,
    currency: 'BRL',
    payerEmail: config.payerEmail,
    providerToken: config.cardToken,
    paymentMethodId: config.paymentMethodId,
  };
  const pixInput: PaymentInput = {
    operationKey: pixKey,
    paymentId: `payment-${pixKey}`,
    orderId: `order-${pixKey}`,
    method: 'PIX',
    amount: config.amount,
    currency: 'BRL',
    payerEmail: config.payerEmail,
  };

  const card = await driver.authorize(cardInput);
  const repeatedCard = await driver.authorize(cardInput);
  assertEqual(card.status, 'AUTHORIZED', 'Card test payment was not approved');
  assertEqual(
    repeatedCard.providerReference,
    card.providerReference,
    'Repeated Card operation returned a different provider payment',
  );
  await assertOneProviderPayment(driver, cardInput);

  const pix = await driver.authorize(pixInput);
  const repeatedPix = await driver.authorize(pixInput);
  assertEqual(pix.status, 'PIX_GENERATED', 'Pix test payment has no QR code');
  assertEqual(
    repeatedPix.providerReference,
    pix.providerReference,
    'Repeated Pix operation returned a different provider payment',
  );
  await assertOneProviderPayment(driver, pixInput);

  const beforeInvalid = await driver.readPayment(card.id);
  const invalidStatus = await driver.notify(
    card.providerReference,
    operationId(),
    'ts=0,v1=invalid',
  );
  assertEqual(invalidStatus, 401, 'Invalid webhook was not rejected');
  assertEqual(
    (await driver.readPayment(card.id)).status,
    beforeInvalid.status,
    'Invalid webhook changed local payment state',
  );

  await driver.refund(card.providerReference, refundKey);
  await driver.refund(card.providerReference, refundKey);
  const providerRefund = await eventually(
    () => driver.readProviderPayment(card.providerReference),
    (payment) =>
      payment.status === 'refunded' && payment.refundIds.length === 1,
    'Provider did not converge to one refund',
  );
  assertEqual(
    providerRefund.refundIds.length,
    1,
    'Repeated refund created a second provider refund',
  );

  const webhookRequestId = operationId();
  const signature = webhookSignature(
    card.providerReference,
    webhookRequestId,
    config.webhookSecret,
  );
  assertEqual(
    await driver.notify(card.providerReference, webhookRequestId, signature),
    200,
    'Valid webhook was not accepted',
  );
  const refunded = await eventually(
    () => driver.readPayment(card.id),
    (payment) => payment.status === 'REFUNDED',
    'Authoritative refund did not reach local state',
  );
  assertEqual(
    await driver.notify(card.providerReference, webhookRequestId, signature),
    200,
    'Repeated valid webhook was not accepted',
  );
  assertEqual(
    (await driver.readPayment(card.id)).status,
    refunded.status,
    'Repeated valid webhook caused another transition',
  );

  return {
    records: [
      evidence(cardKey, card.providerReference, 'CARD_AUTHORIZED_IDEMPOTENT'),
      evidence(pixKey, pix.providerReference, 'PIX_GENERATED_IDEMPOTENT'),
      evidence(cardKey, card.providerReference, 'INVALID_WEBHOOK_REJECTED'),
      evidence(refundKey, card.providerReference, 'REFUND_IDEMPOTENT'),
      evidence(cardKey, card.providerReference, 'WEBHOOK_REPLAY_CONVERGED'),
    ],
  };
}

export function webhookSignature(
  providerReference: string,
  requestId: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1_000).toString(),
): string {
  const manifest = `id:${providerReference.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const digest = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${timestamp},v1=${digest}`;
}

class HttpSandboxDriver implements SandboxDriver {
  constructor(
    private readonly config: SandboxConfig,
    private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  authorize(input: PaymentInput): Promise<SandboxPayment> {
    return this.graphql<SandboxPayment>(
      'mutation AuthorizePayment($input: AuthorizePaymentInput!) { authorizePayment(input: $input) { id operationKey status providerReference pixCode } }',
      { input },
      'authorizePayment',
    );
  }

  readPayment(paymentId: string): Promise<SandboxPayment> {
    return this.graphql<SandboxPayment>(
      'query Payment($id: ID!) { payment(id: $id) { id operationKey status providerReference pixCode } }',
      { id: paymentId },
      'payment',
    );
  }

  async findProviderPayments(
    paymentId: string,
    operationKeyValue: string,
  ): Promise<ProviderPayment[]> {
    const url = new URL('/v1/payments/search', MERCADO_PAGO_API_URL);
    url.searchParams.set('external_reference', paymentId);
    const response = await this.providerJson<{ results?: unknown[] }>(url);
    return (response.results ?? [])
      .map(providerPayment)
      .filter(
        (payment) =>
          payment.externalReference === paymentId &&
          payment.operationKey === operationKeyValue,
      );
  }

  async refund(providerReference: string, operationKeyValue: string) {
    const url = new URL(
      `/v1/payments/${encodeURIComponent(providerReference)}/refunds`,
      MERCADO_PAGO_API_URL,
    );
    await this.providerJson(url, {
      method: 'POST',
      headers: { 'x-idempotency-key': operationKeyValue },
    });
  }

  async readProviderPayment(
    providerReference: string,
  ): Promise<ProviderPayment> {
    const url = new URL(
      `/v1/payments/${encodeURIComponent(providerReference)}`,
      MERCADO_PAGO_API_URL,
    );
    return providerPayment(await this.providerJson(url));
  }

  async notify(
    providerReference: string,
    requestId: string,
    signature: string,
  ): Promise<number> {
    const url = new URL(this.config.webhookUrl);
    url.searchParams.set('data.id', providerReference);
    const response = await this.fetch(url, {
      method: 'POST',
      headers: { 'x-request-id': requestId, 'x-signature': signature },
      signal: AbortSignal.timeout(30_000),
    });
    return response.status;
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    field: string,
  ): Promise<T> {
    const response = await this.fetch(this.config.graphqlUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.bearerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GraphQL request failed (${response.status})`);
    const payload = (await response.json()) as {
      data?: Record<string, T | null>;
      errors?: unknown[];
    };
    if (payload.errors?.length || !payload.data?.[field]) {
      throw new Error(`GraphQL field ${field} failed`);
    }
    return payload.data[field];
  }

  private async providerJson<T = unknown>(
    url: URL,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this.fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30_000),
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Mercado Pago request failed (${response.status})`);
    }
    return (await response.json()) as T;
  }
}

async function assertOneProviderPayment(
  driver: SandboxDriver,
  input: PaymentInput,
) {
  const payments = await eventually(
    () => driver.findProviderPayments(input.paymentId, input.operationKey),
    (matches) => matches.length > 0,
    'Provider payment was not found by its operation key',
  );
  assertEqual(
    payments.length,
    1,
    'Operation key resolved to more than one provider payment',
  );
}

async function eventually<T>(
  read: () => Promise<T>,
  accepted: (value: T) => boolean,
  message: string,
): Promise<T> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const value = await read();
    if (accepted(value)) return value;
    if (attempt < 14) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(message);
}

function providerPayment(value: unknown): ProviderPayment {
  const payment = value as {
    id?: string | number;
    status?: string;
    external_reference?: string;
    metadata?: { operation_key?: string };
    refunds?: Array<{ id?: string | number }>;
  };
  if (payment.id === undefined || typeof payment.status !== 'string') {
    throw new Error('Mercado Pago returned an invalid payment');
  }
  return {
    id: String(payment.id),
    status: payment.status,
    externalReference: payment.external_reference,
    operationKey: payment.metadata?.operation_key,
    refundIds: (payment.refunds ?? [])
      .map(({ id }) => id)
      .filter((id): id is string | number => id !== undefined)
      .map(String),
  };
}

function evidence(
  operationKeyValue: string,
  providerReference: string,
  status: string,
): EvidenceRecord {
  return {
    timestamp: new Date().toISOString(),
    operationKey: operationKeyValue,
    sanitizedReference: `sha256:${createHash('sha256')
      .update(providerReference)
      .digest('hex')
      .slice(0, 16)}`,
    status,
    exitResult: 0,
  };
}

function operationKey(kind: string, id: string) {
  return `mp-sandbox-${kind}-${id}`;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function httpsUrl(environment: NodeJS.ProcessEnv, name: string): string {
  const value = required(environment, name);
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`);
  return url.toString();
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(message);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  Promise.resolve()
    .then(() => verifyMercadoPagoSandbox(sandboxConfigFromEnvironment()))
    .then((proof) => console.log(JSON.stringify(proof, null, 2)))
    .catch(() => {
      console.error(
        'Mercado Pago sandbox verification failed; remote payloads and secrets were not logged.',
      );
      process.exitCode = 1;
    });
}
