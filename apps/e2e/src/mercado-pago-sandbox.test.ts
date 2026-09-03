import { describe, expect, it } from 'vitest';

import {
  sandboxConfigFromEnvironment,
  type ProviderPayment,
  type SandboxConfig,
  type SandboxDriver,
  type SandboxPayment,
  verifyMercadoPagoSandbox,
} from './mercado-pago-sandbox.ts';

const config: SandboxConfig = {
  accessToken: 'private-access-token',
  bearerToken: 'private-bearer-token',
  cardToken: 'private-card-token',
  graphqlUrl: 'https://gateway.example.test/graphql',
  webhookUrl: 'https://payments.example.test/webhooks/mercado-pago',
  webhookSecret: 'private-webhook-secret',
  payerEmail: 'buyer@example.test',
  paymentMethodId: 'visa',
  amount: 10,
};

describe('Mercado Pago sandbox verifier', () => {
  it('requires opt-in inputs, retries Card and Pix once, and emits only redacted evidence @spec:AC-189', async () => {
    expect(() => sandboxConfigFromEnvironment({})).toThrow(
      /MERCADO_PAGO_SANDBOX_CONFIRM/,
    );
    const driver = new FakeDriver();
    const proof = await verifyMercadoPagoSandbox(
      config,
      driver,
      sequentialIds(),
    );

    expect(driver.authorizations).toHaveLength(4);
    expect(driver.authorizations[0].operationKey).toBe(
      driver.authorizations[1].operationKey,
    );
    expect(driver.authorizations[2].operationKey).toBe(
      driver.authorizations[3].operationKey,
    );
    expect(driver.authorizations[0].operationKey).not.toBe(
      driver.authorizations[2].operationKey,
    );
    expect(driver.providerPayments).toHaveLength(2);

    const serialized = JSON.stringify(proof);
    for (const secret of [
      config.accessToken,
      config.bearerToken,
      config.cardToken,
      config.webhookSecret,
      'provider-card',
      'provider-pix',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    for (const record of proof.records) {
      expect(Object.keys(record).sort()).toEqual([
        'exitResult',
        'operationKey',
        'sanitizedReference',
        'status',
        'timestamp',
      ]);
      expect(record.sanitizedReference).toMatch(/^sha256:[0-9a-f]{16}$/);
      expect(record.exitResult).toBe(0);
    }
  });

  it('rejects an invalid webhook and converges one replayed refund to local state @spec:AC-190', async () => {
    const driver = new FakeDriver();
    const proof = await verifyMercadoPagoSandbox(
      config,
      driver,
      sequentialIds(),
    );

    expect(driver.notifications.map(({ status }) => status)).toEqual([
      401, 200, 200,
    ]);
    expect(driver.notifications[1].requestId).toBe(
      driver.notifications[2].requestId,
    );
    expect(driver.refundKeys).toHaveLength(2);
    expect(new Set(driver.refundKeys).size).toBe(1);
    expect(driver.providerPayments[0].refundIds).toHaveLength(1);
    expect(driver.localPayments.get('payment-mp-sandbox-card-id-1')?.status).toBe(
      'REFUNDED',
    );
    expect(proof.records.map(({ status }) => status)).toContain(
      'WEBHOOK_REPLAY_CONVERGED',
    );
  });
});

class FakeDriver implements SandboxDriver {
  readonly authorizations: Array<{
    operationKey: string;
    paymentId: string;
    method: 'CARD' | 'PIX';
  }> = [];
  readonly providerPayments: ProviderPayment[] = [];
  readonly localPayments = new Map<string, SandboxPayment>();
  readonly notifications: Array<{ requestId: string; status: number }> = [];
  readonly refundKeys: string[] = [];

  async authorize(input: {
    operationKey: string;
    paymentId: string;
    method: 'CARD' | 'PIX';
  }) {
    this.authorizations.push(input);
    const existing = this.localPayments.get(input.paymentId);
    if (existing) return existing;
    const providerReference = `provider-${input.method.toLowerCase()}`;
    const payment: SandboxPayment = {
      id: input.paymentId,
      operationKey: input.operationKey,
      status: input.method === 'CARD' ? 'AUTHORIZED' : 'PIX_GENERATED',
      providerReference,
      pixCode: input.method === 'PIX' ? 'redacted-from-evidence' : null,
    };
    this.localPayments.set(input.paymentId, payment);
    this.providerPayments.push({
      id: providerReference,
      status: input.method === 'CARD' ? 'approved' : 'pending',
      externalReference: input.paymentId,
      operationKey: input.operationKey,
      refundIds: [],
    });
    return payment;
  }

  async readPayment(paymentId: string) {
    return requiredValue(this.localPayments.get(paymentId));
  }

  async findProviderPayments(paymentId: string, operationKey: string) {
    return this.providerPayments.filter(
      (payment) =>
        payment.externalReference === paymentId &&
        payment.operationKey === operationKey,
    );
  }

  async refund(providerReference: string, operationKey: string) {
    this.refundKeys.push(operationKey);
    const payment = requiredValue(
      this.providerPayments.find(({ id }) => id === providerReference),
    );
    payment.status = 'refunded';
    if (payment.refundIds.length === 0) payment.refundIds.push('refund-1');
  }

  async readProviderPayment(providerReference: string) {
    return requiredValue(
      this.providerPayments.find(({ id }) => id === providerReference),
    );
  }

  async notify(
    providerReference: string,
    requestId: string,
    signature: string,
  ) {
    const valid = !signature.includes('invalid');
    const status = valid ? 200 : 401;
    this.notifications.push({ requestId, status });
    if (valid) {
      const local = requiredValue(
        [...this.localPayments.values()].find(
          (payment) => payment.providerReference === providerReference,
        ),
      );
      local.status = 'REFUNDED';
    }
    return status;
  }
}

function sequentialIds() {
  let id = 0;
  return () => `id-${(id += 1)}`;
}

function requiredValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture value');
  return value;
}
