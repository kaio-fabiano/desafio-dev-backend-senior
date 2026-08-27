import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startMilestone7Environment, type Milestone7Environment } from './environment.ts';
import { runAcceptanceJourney, type AcceptanceProof } from './journey.ts';

const requiredComponents = [
  'identity-database',
  'postgres',
  'payment-database',
  'wordpress-database',
  'rabbitmq',
  'wordpress',
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
      await environment.stop();
      throw error;
    }
  });

  afterAll(async () => {
    await environment?.stop();
  });

  it('starts the complete isolated topology from one target @spec:AC-067', async () => {
    expect(environment?.startedComponents).toEqual(requiredComponents);
    await expect(fetch(`${environment!.gatewayUrl}/ready`).then(({ status }) => status)).resolves.toBe(200);
    await expect(fetch(environment!.mcpUrl.replace('/mcp', '/health')).then(({ status }) => status)).resolves.toBe(200);
  });

  it('links registration identities and accepts one multi-resource OAuth token @spec:AC-068', () => {
    expect(proof.identity.buyer).toMatchObject({
      email: 'milestone-7-buyer@example.test',
      emailAccountId: expect.stringMatching(/^email-/),
      wordpressAccountId: expect.stringMatching(/^wp-/),
    });
    expect(proof.identity.claims.aud).toEqual([
      'https://gateway.marketplace.local',
      'https://mcp.marketplace.local',
    ]);
    expect(proof.identity).toMatchObject({ gatewayAccepted: true, mcpAccepted: true });
  });

  it('converges Card checkout across subscription, federation, and persistence exactly once @spec:AC-069', () => {
    expect(proof.card.subscriptionOpenedBeforeCheckout).toBe(true);
    expect(proof.card.checkout).toEqual(proof.card.retry);
    expect(proof.card.checkout).toMatchObject({ orderCount: 1, chargeCount: 1, order: { status: 'APPROVED' } });
    expect(proof.card.event).toEqual(proof.card.checkout.order);
    expect(proof.card.meOrder).toEqual(proof.card.checkout.order);
    expect(proof.card.persistedOrder).toEqual(proof.card.checkout.order);
  });

  it('converges Pix checkout on one stable generated code @spec:AC-070', () => {
    expect(proof.pix.subscriptionOpenedBeforeCheckout).toBe(true);
    expect(proof.pix.checkout.order.status).toBe('PIX_GENERATED');
    expect(proof.pix.checkout.order.pixCode).toMatch(/^PIX-/);
    expect(proof.pix.event).toEqual(proof.pix.checkout.order);
    expect(proof.pix.meOrder).toEqual(proof.pix.checkout.order);
  });

  it('proves MCP parity and rejects missing, wrong-audience, and under-scoped tokens @spec:AC-071', () => {
    expect(proof.mcp.toolMe).toEqual(proof.mcp.directMe);
    expect(proof.mcp.rejectionStatuses).toEqual([401, 401, 403]);
  });
});
