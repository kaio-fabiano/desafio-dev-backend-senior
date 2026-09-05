import type { MikroORM } from '@mikro-orm/core';
import { describe, expect, it, vi } from 'vitest';

import { MikroOrmOrderEventReplay } from './mikro-orm-order-event.replay.ts';

describe('MikroOrmOrderEventReplay', () => {
  it('loads the latest owner event with parameterized SQL @spec:AC-231', async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        operation_key: 'operation-231',
        pix_code: 'pix-231',
        state: 'PIX_GENERATED',
        subject: 'buyer-231',
        updated_at: new Date(0),
        version: 3,
        woo_order_id: '731',
      },
    ]);
    const replay = new MikroOrmOrderEventReplay(ormWith(execute));

    await expect(replay.latest('buyer-231', 'operation-231')).resolves.toEqual({
      eventTime: new Date(0).toISOString(),
      operationKey: 'operation-231',
      orderId: '731',
      pixCode: 'pix-231',
      state: 'PIX_GENERATED',
      version: 3,
    });
    expect(execute.mock.calls[0]?.[1]).toEqual(['buyer-231', 'operation-231']);
  });

  it('resolves relay notifications and missing rows @spec:AC-231', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        {
          operation_key: 'operation-231',
          state: 'PAYMENT_PENDING',
          subject: 'buyer-231',
          updated_at: '1970-01-01T00:00:00.000Z',
          version: 2,
          woo_order_id: '731',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const replay = new MikroOrmOrderEventReplay(ormWith(execute));

    await expect(replay.byWorkflowId('workflow-231')).resolves.toEqual({
      subject: 'buyer-231',
      operationKey: 'operation-231',
      payload: {
        eventTime: new Date(0).toISOString(),
        operationKey: 'operation-231',
        orderId: '731',
        state: 'PAYMENT_PENDING',
        version: 2,
      },
    });
    await expect(replay.byWorkflowId('missing')).resolves.toBeNull();
    await expect(replay.latest('buyer-231', 'missing')).resolves.toBeNull();
    expect(execute.mock.calls[0]?.[1]).toEqual(['workflow-231']);
  });
});

function ormWith(execute: ReturnType<typeof vi.fn>): MikroORM {
  return {
    em: { fork: () => ({ getConnection: () => ({ execute }) }) },
  } as unknown as MikroORM;
}
