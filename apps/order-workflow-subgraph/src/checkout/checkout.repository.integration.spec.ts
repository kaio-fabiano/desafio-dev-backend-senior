import { randomUUID } from 'node:crypto';

import type { EntityManager } from '@mikro-orm/core';
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

import {
    CheckoutOperation,
    CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';
import mikroOrmConfig from '../persistence/mikro-orm.config.ts';
import {
    MikroOrmCheckoutRepository,
    type ConfirmCheckout,
} from './checkout.repository.ts';

describe('MikroOrmCheckoutRepository', () => {
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
    await orm.em
      .getConnection()
      .execute(
        'truncate table "order_workflow_outbox_event", "order_workflow_order_workflow", "order_workflow_checkout_operation" cascade',
      );
  });

  afterAll(async () => {
    await orm?.close(true);
    await container?.stop();
  });

  it('grants one lease for concurrent claims of an operation key @spec:AC-229', async () => {
    const input = {
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    };
    const first = new MikroOrmCheckoutRepository(orm.em.fork());
    const second = new MikroOrmCheckoutRepository(orm.em.fork());

    const claims = await Promise.all([first.claim(input), second.claim(input)]);

    expect(new Set(claims.map(({ operation }) => operation.id)).size).toBe(1);
    expect(claims.filter(({ ownerToken }) => ownerToken !== null)).toHaveLength(
      1,
    );
  });

  it('rolls back a claim when work after its insert fails @spec:AC-229 @spec:AC-230', async () => {
    const entityManager = orm.em.fork();
    const failAfterInsert = {
      transactional: <T>(
        work: (transaction: EntityManager) => Promise<T>,
        options?: Parameters<EntityManager['transactional']>[1],
      ) =>
        entityManager.transactional(
          (transaction) =>
            work({
              findOneOrFail: async () => {
                throw new Error('forced post-insert failure');
              },
              getConnection: () => transaction.getConnection(),
              getTransactionContext: () => transaction.getTransactionContext(),
            } as unknown as EntityManager),
          options,
        ),
    } as EntityManager;
    const repository = new MikroOrmCheckoutRepository(failAfterInsert);

    await expect(
      repository.claim({
        subject: 'buyer-rollback',
        operationKey: 'operation-rollback',
        commandHash: 'a'.repeat(64),
        wooReference: 'reference-rollback',
      }),
    ).rejects.toThrow('forced post-insert failure');

    expect(
      await orm.em.fork().count(CheckoutOperation, {
        operationKey: 'operation-rollback',
      }),
    ).toBe(0);
  });

  it('prevents an expired owner from confirming after another owner acquires the lease @spec:AC-229', async () => {
    const first = new MikroOrmCheckoutRepository(orm.em.fork());
    const second = new MikroOrmCheckoutRepository(orm.em.fork());
    const input = {
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    };
    const original = await first.claim(input);
    const originalOwner = requiredOwnerToken(original.ownerToken);
    await first.beginCreation(original.operation.id, originalOwner);
    await orm.em
      .getConnection()
      .execute(
        'update "order_workflow_checkout_operation" set "lease_until" = current_timestamp - interval \'1 second\' where "id" = ?',
        [original.operation.id],
      );
    const replacement = await second.claim(input);
    const onConfirmed = vi.fn(async () => undefined);

    await expect(
      first.confirm(
        original.operation.id,
        'woo-stale',
        [{ productId: '1001', quantity: 1 }],
        onConfirmed,
        'CARD',
        originalOwner,
      ),
    ).rejects.toThrow(/lease was lost/);
    expect(replacement.ownerToken).not.toBe(originalOwner);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(await orm.em.fork().count(OrderWorkflow)).toBe(0);
  });

  it('does not start remote creation after a lease expires @spec:AC-229', async () => {
    const repository = new MikroOrmCheckoutRepository(orm.em.fork());
    const claim = await repository.claim({
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    });
    const ownerToken = requiredOwnerToken(claim.ownerToken);
    await orm.em
      .getConnection()
      .execute(
        'update "order_workflow_checkout_operation" set "lease_until" = current_timestamp - interval \'1 second\' where "id" = ?',
        [claim.operation.id],
      );

    await expect(
      repository.beginCreation(claim.operation.id, ownerToken),
    ).rejects.toThrow(/lease was lost/);
  });

  it('releases only the current owner and permits recovery @spec:AC-229', async () => {
    const first = new MikroOrmCheckoutRepository(orm.em.fork());
    const second = new MikroOrmCheckoutRepository(orm.em.fork());
    const input = {
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    };
    const original = await first.claim(input);
    const originalOwner = requiredOwnerToken(original.ownerToken);

    await first.release(
      original.operation.id,
      '26a20206-6f60-4c95-91bc-3bab50e3851e',
    );
    expect((await second.claim(input)).ownerToken).toBeNull();
    await first.release(original.operation.id, originalOwner);
    const recovered = await second.claim(input);

    expect(recovered.ownerToken).not.toBeNull();
    expect(recovered.ownerToken).not.toBe(originalOwner);
  });

  it('rolls back workflow and outbox persistence together @spec:AC-229', async () => {
    const repository = new MikroOrmCheckoutRepository(orm.em.fork());
    const claim = await repository.claim({
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    });
    const ownerToken = requiredOwnerToken(claim.ownerToken);
    await repository.beginCreation(claim.operation.id, ownerToken);

    await expect(
      repository.confirm(
        claim.operation.id,
        'woo-1',
        [{ productId: '1001', quantity: 1 }],
        async (transaction, workflow) => {
          const em = transaction as typeof orm.em;
          em.persist(
            em.create(OutboxEvent, {
              id: 'e5c8d86a-a1d9-4ccd-8358-6c17c0cc4514',
              workflowId: workflow.id,
              eventType: 'payment.requested',
              payload: {},
              occurredAt: new Date(),
              publicationAttempts: 0,
            }),
          );
          throw new Error('outbox write failed');
        },
        'CARD',
        ownerToken,
      ),
    ).rejects.toThrow('outbox write failed');
    const em = orm.em.fork();
    expect(await em.count(OrderWorkflow)).toBe(0);
    expect(await em.count(OutboxEvent)).toBe(0);
    const operation = await em.findOneOrFail(CheckoutOperation, {
      id: claim.operation.id,
    });
    expect(operation.status).toBe(CheckoutOperationStatus.CreatingWoo);
  });

  it('commits workflow state and the confirmation callback together @spec:AC-229', async () => {
    const repository = new MikroOrmCheckoutRepository(orm.em.fork());
    const claim = await repository.claim({
      subject: 'buyer-1',
      operationKey: 'operation-1',
      commandHash: 'a'.repeat(64),
      wooReference: 'reference-1',
    });
    const ownerToken = requiredOwnerToken(claim.ownerToken);
    await repository.beginCreation(claim.operation.id, ownerToken);
    const onConfirmed = vi.fn<ConfirmCheckout>(
      async (transaction, workflow) => {
        const em = transaction as typeof orm.em;
        em.persist(
          em.create(OutboxEvent, {
            id: 'e5c8d86a-a1d9-4ccd-8358-6c17c0cc4514',
            workflowId: workflow.id,
            eventType: 'payment.requested',
            payload: {},
            occurredAt: new Date(),
            publicationAttempts: 0,
          }),
        );
      },
    );

    const workflow = await repository.confirm(
      claim.operation.id,
      'woo-1',
      [{ productId: '1001', quantity: 1 }],
      onConfirmed,
      'CARD',
      ownerToken,
    );

    const em = orm.em.fork();
    const operation = await em.findOneOrFail(CheckoutOperation, {
      id: claim.operation.id,
    });
    expect(workflow.wooOrderId).toBe('woo-1');
    expect(operation).toMatchObject({
      status: CheckoutOperationStatus.Completed,
      wooOrderId: 'woo-1',
      ownerToken: null,
      leaseUntil: null,
    });
    expect(await em.count(OutboxEvent)).toBe(1);
    expect(onConfirmed).toHaveBeenCalledOnce();
  });
});

function requiredOwnerToken(value: string | null): string {
  if (!value) throw new Error('Test setup did not acquire a checkout lease');
  return value;
}
