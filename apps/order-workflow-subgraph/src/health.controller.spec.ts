import type { MikroORM } from '@mikro-orm/core';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller.ts';
import type { OrderWorkflowRuntimeLifecycle } from './messaging/order-workflow-messaging.runtime.ts';
import type { PostgresOrderEventRelay } from './order-events/postgres/postgres-order-event.relay.ts';

describe('HealthController', () => {
  it('reports liveness independently and readiness after all dependencies connect @spec:AC-231', async () => {
    const checkConnection = vi.fn().mockResolvedValue({ ok: true });
    const controller = healthController(true, true, checkConnection);

    expect(controller.health()).toEqual({ status: 'ok' });
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    controller.onApplicationBootstrap();
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
    expect(checkConnection).toHaveBeenCalledOnce();
  });

  it.each([
    [false, true, { ok: true }],
    [true, false, { ok: true }],
    [true, true, { ok: false, reason: 'database unavailable' }],
  ])(
    'rejects readiness when a dependency is unavailable %# @spec:AC-231',
    async (relay, messaging, database) => {
      const controller = healthController(
        relay,
        messaging,
        vi.fn().mockResolvedValue(database),
      );
      controller.onApplicationBootstrap();
      await expect(controller.ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
});

function healthController(
  relay: boolean,
  messaging: boolean,
  checkConnection: ReturnType<typeof vi.fn>,
) {
  return new HealthController(
    { connected: relay } as PostgresOrderEventRelay,
    { connected: messaging } as OrderWorkflowRuntimeLifecycle,
    { checkConnection } as unknown as MikroORM,
  );
}
