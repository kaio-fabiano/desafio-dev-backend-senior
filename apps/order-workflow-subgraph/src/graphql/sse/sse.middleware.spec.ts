import { expect, it, vi } from 'vitest';

import { OrderWorkflowSseConnections } from './sse.middleware.ts';

it('rejects new streams once shutdown starts and waits for accepted work @spec:AC-231', async () => {
  const connections = new OrderWorkflowSseConnections();
  const firstAbort = new AbortController();
  let finish: (() => void) | undefined;
  const first = connections.track(
    {} as never,
    firstAbort,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const shutdown = connections.beforeApplicationShutdown();
  expect(firstAbort.signal.aborted).toBe(true);

  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const start = vi.fn(async () => undefined);
  await connections.track(
    { status, json } as never,
    new AbortController(),
    start,
  );
  expect(status).toHaveBeenCalledWith(503);
  expect(json).toHaveBeenCalledWith({
    errors: [{ message: 'Subscription service is shutting down' }],
  });
  expect(start).not.toHaveBeenCalled();

  finish?.();
  await first;
  await shutdown;
});
