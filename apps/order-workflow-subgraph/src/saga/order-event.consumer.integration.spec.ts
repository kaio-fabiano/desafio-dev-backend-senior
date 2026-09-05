import { randomUUID } from 'node:crypto';

import { MikroORM } from '@mikro-orm/postgresql';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { MikroOrmInboxRepository } from '../inbox/inbox.repository.ts';
import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';
import mikroOrmConfig from '../persistence/mikro-orm.config.ts';
import { OrderEventConsumer } from './order-event.consumer.ts';
import { MikroOrmOrderSagaRepository } from './order-saga.repository.ts';
import { PostgresTransactionalOrderEventNotifier } from './postgres-order-event.notifier.ts';

describe('transactional order event delivery', () => {
  let container: StartedTestContainer;
  let orm: MikroORM;

  beforeAll(async () => {
    const databasePassword = randomUUID();
    container = await new GenericContainer('postgres:17-alpine')
      .withEnvironment({
        POSTGRES_DB: 'order_workflow',
        POSTGRES_PASSWORD: databasePassword,
        POSTGRES_USER: 'postgres',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2),
      )
      .start();
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: container.getHost(),
      port: container.getMappedPort(5432),
      password: databasePassword,
      migrations: { ...mikroOrmConfig.migrations, snapshot: false },
    });
    await orm.getMigrator().up();
  }, 60_000);

  beforeEach(async () => {
    await orm.em.getConnection().execute(
      `truncate table "order_workflow_outbox_event",
        "order_workflow_inbox_record", "order_workflow_order_workflow",
        "order_workflow_checkout_operation" cascade`,
    );
  });

  afterAll(async () => {
    await orm?.close(true);
    await container?.stop();
  });

  it('commits the inbox, saga state, command, and notification atomically @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000001';
    await seedWorkflow('operation-1', workflowId, 'order-1');
    const consumer = orderEventConsumer();
    const event = {
      eventId: '747f3d18-0fcf-4d78-8880-c26ff51f5aa0',
      eventType: 'payment.authorized' as const,
      payload: {
        orderId: 'order-1',
        paymentId: 'payment-1',
        providerReference: 'provider-1',
      },
    };

    await expect(consumer.consume(event)).resolves.toMatchObject({
      outcome: 'applied',
    });
    await expect(consumer.consume(event)).resolves.toEqual({
      outcome: 'duplicate',
    });

    const [workflow] = await rows<{
      payment_id: string;
      state: string;
      version: number;
    }>(
      `select payment_id, state, version
         from "order_workflow_order_workflow" where id = ?`,
      [workflowId],
    );
    const [inbox] = await rows<{ disposition: string }>(
      `select disposition from "order_workflow_inbox_record"
        where event_id = ?`,
      [event.eventId],
    );
    const commands = await rows<{ event_type: string; payload: unknown }>(
      `select event_type, payload from "order_workflow_outbox_event"`,
    );
    expect(workflow).toEqual({
      payment_id: 'payment-1',
      state: 'STOCK_PENDING',
      version: 1,
    });
    expect(inbox?.disposition).toBe('APPLIED');
    expect(commands).toEqual([
      {
        event_type: 'stock.reservation-requested',
        payload: {
          operationKey: 'operation-1',
          orderId: 'order-1',
          items: [{ productId: 'product-1', quantity: 2 }],
        },
      },
    ]);
  });

  it('rolls back an inbox claim when saga processing fails @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000002';
    await seedWorkflow('operation-2', workflowId, 'order-2');
    const consumer = orderEventConsumer();
    const event = {
      eventId: 'f2f22fe9-8708-47c3-9158-10b523225aae',
      eventType: 'payment.authorized' as const,
      payload: {
        orderId: 'order-2',
        paymentId: '',
        providerReference: 'provider-2',
      },
    };

    await expect(consumer.consume(event)).rejects.toThrow('paymentId');
    expect(
      await rows(
        `select event_id from "order_workflow_inbox_record" where event_id = ?`,
        [event.eventId],
      ),
    ).toHaveLength(0);
    expect(
      await rows(
        `select event_type from "order_workflow_outbox_event" where workflow_id = ?`,
        [workflowId],
      ),
    ).toHaveLength(0);
  });

  it('grants exactly one concurrent inbox claim @spec:AC-230', async () => {
    const inbox = new MikroOrmInboxRepository();
    const eventId = 'f2f22fe9-8708-47c3-9158-10b523225aaf';

    const claims = await Promise.all(
      Array.from({ length: 8 }, () =>
        orm.em
          .fork()
          .transactional((transaction) =>
            inbox.claim(transaction, eventId, 'payment.authorized'),
          ),
      ),
    );

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(
      await rows(
        `select event_id from "order_workflow_inbox_record" where event_id = ?`,
        [eventId],
      ),
    ).toHaveLength(1);
  });

  it('records a replay against terminal state as ignored @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000006';
    await seedWorkflow('operation-6', workflowId, 'order-6');
    await orm.em.getConnection().execute(
      `update "order_workflow_order_workflow" set state = 'COMPLETED'
        where id = ?`,
      [workflowId],
    );
    const acknowledge = vi.fn(async () => undefined);

    const result = await orderEventConsumer().handle(
      {
        eventId: 'f2f22fe9-8708-47c3-9158-10b523225ab0',
        eventType: 'stock.reserved',
        payload: { orderId: 'order-6', reservationId: 'reservation-6' },
      },
      acknowledge,
    );

    expect(result.outcome).toBe('ignored');
    expect(acknowledge).toHaveBeenCalledOnce();
    const [inbox] = await rows<{ disposition: string }>(
      `select disposition from "order_workflow_inbox_record"
        where event_id = ?`,
      ['f2f22fe9-8708-47c3-9158-10b523225ab0'],
    );
    expect(inbox?.disposition).toBe('IGNORED');
  });

  it('rejects missing order metadata before claiming the inbox @spec:AC-230', async () => {
    const acknowledge = vi.fn(async () => undefined);
    await expect(
      orderEventConsumer().handle(
        {
          eventId: 'f2f22fe9-8708-47c3-9158-10b523225ab1',
          eventType: 'stock.reserved',
          payload: {},
        },
        acknowledge,
      ),
    ).rejects.toThrow('orderId');
    expect(acknowledge).not.toHaveBeenCalled();
    expect(
      await rows(`select event_id from "order_workflow_inbox_record"`),
    ).toHaveLength(0);
  });

  it('rolls back the inbox claim when no workflow matches the order @spec:AC-230', async () => {
    const eventId = 'f2f22fe9-8708-47c3-9158-10b523225ab2';

    await expect(
      orderEventConsumer().consume({
        eventId,
        eventType: 'stock.reserved',
        payload: { orderId: 'missing-order', reservationId: 'reservation-230' },
      }),
    ).rejects.toThrow('was not found');
    expect(
      await rows(
        `select event_id from "order_workflow_inbox_record" where event_id = ?`,
        [eventId],
      ),
    ).toHaveLength(0);
  });

  it('persists nullable transition fields without stale values @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000008';
    await seedWorkflow('operation-8', workflowId, 'order-8');
    await orm.em.getConnection().execute(
      `update "order_workflow_order_workflow"
          set state = 'STOCK_PENDING', payment_id = null, pix_code = null
        where id = ?`,
      [workflowId],
    );

    await expect(
      orderEventConsumer().consume({
        eventId: 'f2f22fe9-8708-47c3-9158-10b523225ab3',
        eventType: 'stock.reserved',
        payload: { orderId: 'order-8', reservationId: 'reservation-8' },
      }),
    ).resolves.toMatchObject({ outcome: 'applied' });
    const [workflow] = await rows<{
      payment_id: string | null;
      pix_code: string | null;
    }>(
      `select payment_id, pix_code from "order_workflow_order_workflow"
        where id = ?`,
      [workflowId],
    );
    expect(workflow).toEqual({ payment_id: null, pix_code: null });
  });

  it('claims distinct unsent rows while another publisher holds a lock @spec:AC-230', async () => {
    const firstWorkflow = '10000000-0000-4000-8000-000000000003';
    const secondWorkflow = '10000000-0000-4000-8000-000000000004';
    await seedWorkflow('operation-3', firstWorkflow, 'order-3');
    await seedWorkflow('operation-4', secondWorkflow, 'order-4');
    await seedOutbox('a0000000-0000-4000-8000-000000000001', firstWorkflow);
    await seedOutbox('a0000000-0000-4000-8000-000000000002', secondWorkflow);
    const outbox = new MikroOrmOutboxRepository();

    const claimedIds = await orm.em.fork().transactional(async (firstTx) => {
      const [first] = await outbox.claimUnsent(firstTx, 1);
      const [second] = await orm.em
        .fork()
        .transactional((secondTx) => outbox.claimUnsent(secondTx, 1));
      return [first?.id, second?.id];
    });

    expect(new Set(claimedIds).size).toBe(2);
  });

  it('increments concurrent publication attempts without lost updates @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000005';
    await seedWorkflow('operation-5', workflowId, 'order-5');
    const eventId = 'a0000000-0000-4000-8000-000000000005';
    await seedOutbox(eventId, workflowId);
    const outbox = new MikroOrmOutboxRepository();

    await Promise.all(
      Array.from({ length: 8 }, () =>
        outbox.markPublicationAttempt(orm.em.fork(), eventId, new Date()),
      ),
    );

    const event = await orm.em.fork().findOneOrFail(OutboxEvent, eventId);
    expect(event.publicationAttempts).toBe(8);
  });

  it('enqueues and marks an outbox event through the transaction manager @spec:AC-230', async () => {
    const workflowId = '10000000-0000-4000-8000-000000000007';
    await seedWorkflow('operation-7', workflowId, 'order-7');
    const outbox = new MikroOrmOutboxRepository();

    await orm.em.fork().transactional((transaction) =>
      outbox.enqueueCheckoutRequested(transaction, workflowId, {
        amount: 19.9,
        checkoutId: 'checkout-7',
        currency: 'BRL',
        method: 'CARD',
        operationKey: 'operation-7',
        orderId: 'order-7',
        payerEmail: 'buyer-7@example.test',
        paymentId: 'payment-7',
      }),
    );
    const [event] = await orm.em.fork().find(OutboxEvent, { workflowId });
    if (!event) throw new Error('Expected an enqueued outbox event');
    expect(event?.eventType).toBe('payment.requested');

    await outbox.markSent(orm.em.fork(), event.id, new Date());
    expect(
      (await orm.em.fork().findOneOrFail(OutboxEvent, event.id)).sentAt,
    ).toBeInstanceOf(Date);
  });

  function orderEventConsumer(): OrderEventConsumer {
    return new OrderEventConsumer(
      orm.em.fork(),
      new MikroOrmInboxRepository(),
      new MikroOrmOrderSagaRepository(
        new PostgresTransactionalOrderEventNotifier(),
      ),
      async () => [{ productId: 'product-1', quantity: 2 }],
    );
  }

  async function seedWorkflow(
    operationKey: string,
    workflowId: string,
    orderId: string,
  ): Promise<void> {
    await orm.em.getConnection().execute(
      `insert into "order_workflow_checkout_operation"
        (id, subject, operation_key, command_hash, status, woo_reference,
         woo_order_id, created_at, updated_at)
       values (?, 'buyer-230', ?, ?, 'COMPLETED', ?, ?,
               current_timestamp, current_timestamp)`,
      [randomUUID(), operationKey, 'a'.repeat(64), operationKey, orderId],
    );
    const [operation] = await rows<{ id: string }>(
      `select id from "order_workflow_checkout_operation"
        where operation_key = ?`,
      [operationKey],
    );
    await orm.em.getConnection().execute(
      `insert into "order_workflow_order_workflow"
        (id, checkout_operation_id, woo_order_id, stock_items, state,
         version, created_at, updated_at)
       values (?, ?, ?, cast(? as jsonb), 'CREATED', 0,
               current_timestamp, current_timestamp)`,
      [
        workflowId,
        operation?.id,
        orderId,
        JSON.stringify([{ productId: 'product-1', quantity: 2 }]),
      ],
    );
  }

  function seedOutbox(eventId: string, workflowId: string): Promise<unknown> {
    return orm.em.getConnection().execute(
      `insert into "order_workflow_outbox_event"
        (id, workflow_id, event_type, payload, occurred_at,
         publication_attempts)
       values (?, ?, 'payment.requested', cast(? as jsonb),
               current_timestamp, 0)`,
      [eventId, workflowId, JSON.stringify({ operationKey: workflowId })],
    );
  }

  function rows<T = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<T[]> {
    return orm.em.getConnection().execute(sql, [...parameters]) as Promise<T[]>;
  }
});
