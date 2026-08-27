import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

import { InboxDisposition } from '../../inbox/inbox.repository.ts';

export class InboxRecord {
  eventId!: string;
  eventType!: string;
  workflowId?: string;
  disposition?: InboxDisposition;
  receivedAt = new Date();
  processedAt?: Date;
}

Entity({ tableName: 'commerce_inbox_record' })(InboxRecord);
PrimaryKey({ type: 'uuid' })(InboxRecord.prototype, 'eventId');
Property({ length: 100 })(InboxRecord.prototype, 'eventType');
Property({ type: 'uuid', nullable: true })(InboxRecord.prototype, 'workflowId');
Property({ length: 16, nullable: true })(InboxRecord.prototype, 'disposition');
Property()(InboxRecord.prototype, 'receivedAt');
Property({ nullable: true })(InboxRecord.prototype, 'processedAt');
