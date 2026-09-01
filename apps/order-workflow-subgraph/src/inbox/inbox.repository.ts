import type { EntityManager } from '@mikro-orm/core';

export enum InboxDisposition {
  Applied = 'APPLIED',
  Ignored = 'IGNORED',
}

export interface InboxRepository {
  claim(
    transaction: EntityManager,
    eventId: string,
    eventType: string,
  ): Promise<boolean>;
  complete(
    transaction: EntityManager,
    eventId: string,
    workflowId: string,
    disposition: InboxDisposition,
  ): Promise<void>;
}

export class MikroOrmInboxRepository implements InboxRepository {
  async claim(
    transaction: EntityManager,
    eventId: string,
    eventType: string,
  ): Promise<boolean> {
    const rows = (await transaction.getConnection().execute(
      `insert into "order_workflow_inbox_record"
        ("event_id", "event_type", "received_at")
       values (?, ?, current_timestamp)
       on conflict ("event_id") do nothing
       returning "event_id"`,
      [eventId, eventType],
    )) as unknown[];
    return rows.length === 1;
  }

  async complete(
    transaction: EntityManager,
    eventId: string,
    workflowId: string,
    disposition: InboxDisposition,
  ): Promise<void> {
    await transaction.getConnection().execute(
      `update "order_workflow_inbox_record"
          set "workflow_id" = ?, "disposition" = ?, "processed_at" = current_timestamp
        where "event_id" = ?`,
      [workflowId, disposition, eventId],
    );
  }
}
