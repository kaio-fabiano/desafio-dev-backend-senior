import { Entity, JsonType, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'order_workflow_outbox_event' })
export class OutboxEvent {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  workflowId!: string;

  @Property({ type: 'string', length: 100 })
  eventType!: string;

  @Property({ type: JsonType })
  payload!: Record<string, unknown>;

  @Property({ type: Date })
  occurredAt = new Date();

  @Property({ type: 'integer', default: 0 })
  publicationAttempts = 0;

  @Property({ type: Date, nullable: true })
  lastPublicationAttemptAt?: Date;

  @Property({ type: Date, nullable: true })
  sentAt?: Date;
}
