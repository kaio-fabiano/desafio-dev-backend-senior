import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startMilestone7Environment,
  type Milestone7Environment,
} from './environment.ts';
import { runAcceptanceJourney, type AcceptanceProof } from './journey.ts';

const requiredComponents = [
  'identity-database',
  'postgres',
  'payment-database',
  'wordpress-database',
  'rabbitmq',
  'wordpress',
  'wordpress-setup',
  'identity-subgraph',
  'commerce-subgraph',
  'stock-worker',
  'payment-processor',
  'gateway',
  'apollo-mcp',
];

describe.sequential('Milestone 7 complete acceptance journey', () => {
  let environment: Milestone7Environment | undefined;
  let proof: AcceptanceProof;

  beforeAll(async () => {
    environment = await startMilestone7Environment();
    try {
      proof = await runAcceptanceJourney(environment);
    } catch (error) {
      console.error(await environment.diagnostics());
      if (!process.env.KEEP_E2E_ON_FAILURE) await environment.stop();
      throw error;
    }
  }, 600_000);

  afterAll(async () => {
    if (!process.env.KEEP_E2E_ON_FAILURE) await environment?.stop();
  }, 120_000);

  it('starts the complete isolated topology from one target @spec:AC-067', async () => {
    expect(environment?.startedComponents).toEqual(requiredComponents);
    await expect(
      fetch(`${environment!.gatewayUrl}/ready`).then(({ status }) => status),
    ).resolves.toBe(200);
    await expect(
      fetch(environment!.mcpUrl.replace('/mcp', '/health')).then(
        ({ status }) => status,
      ),
    ).resolves.toBe(200);
  });

  it('links registration identities and accepts one multi-resource OAuth token @spec:AC-068', () => {
    expect(proof.identity.buyer).toMatchObject({
      email: 'milestone-7-buyer@example.test',
    });
    expect(proof.identity.claims.aud).toEqual([
      'https://gateway.marketplace.local',
      'https://mcp.marketplace.local',
    ]);
    expect(proof.identity).toMatchObject({
      gatewayAccepted: true,
      mcpAccepted: true,
    });
  });

  it('converges Card checkout across subscription, federation, and persistence exactly once @spec:AC-069', () => {
    expect(proof.card.subscriptionOpenedBeforeCheckout).toBe(true);
    expect(proof.card.retry.wooOrderId).toBe(proof.card.checkout.wooOrderId);
    expect(proof.card.event).toMatchObject({
      operationKey: 'milestone-7-card',
      orderId: proof.card.checkout.wooOrderId,
      state: 'COMPLETED',
    });
    expect(proof.card.retry.workflow.state).toBe('COMPLETED');
    expect(proof.card.meOrder).toMatchObject({
      wooOrderId: proof.card.checkout.wooOrderId,
      paymentMethod: 'CARD',
    });
  });

  it('converges Pix checkout on one stable generated code @spec:AC-070', () => {
    expect(proof.pix.subscriptionOpenedBeforeCheckout).toBe(true);
    expect(proof.pix.event).toMatchObject({
      operationKey: 'milestone-7-pix',
      orderId: proof.pix.checkout.wooOrderId,
      state: 'PIX_GENERATED',
      pixCode: expect.stringMatching(/^PIX-/),
    });
    expect(proof.pix.meOrder).toMatchObject({
      wooOrderId: proof.pix.checkout.wooOrderId,
      paymentMethod: 'PIX',
    });
  });

  it('proves MCP parity and rejects missing, wrong-audience, and under-scoped tokens @spec:AC-071', () => {
    expect(proof.mcp.toolMe).toEqual(proof.mcp.directMe);
    expect(proof.mcp.rejectionStatuses).toEqual([401, 401, 403]);
  });
});
