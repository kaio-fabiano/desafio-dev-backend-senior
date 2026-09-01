import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

import { InboxDisposition } from '../../inbox/inbox.repository.ts';

@Entity({ tableName: 'order_workflow_inbox_record' })
export class InboxRecord {
  @PrimaryKey({ type: 'uuid' })
  eventId!: string;

  @Property({ type: 'string', length: 100 })
  eventType!: string;

  @Property({ type: 'uuid', nullable: true })
  workflowId?: string;

  @Property({ type: 'string', length: 16, nullable: true })
  disposition?: InboxDisposition;

  @Property({ type: Date })
  receivedAt = new Date();

  @Property({ type: Date, nullable: true })
  processedAt?: Date;
}
