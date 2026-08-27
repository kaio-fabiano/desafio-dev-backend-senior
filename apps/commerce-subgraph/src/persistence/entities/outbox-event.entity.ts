import { Entity, JsonType, PrimaryKey, Property, Unique } from '@mikro-orm/core';

export class OutboxEvent {
  id!: string;
  workflowId!: string;
  eventType!: string;
  payload!: Record<string, unknown>;
  occurredAt = new Date();
  sentAt?: Date;
}

Entity({ tableName: 'commerce_outbox_event' })(OutboxEvent);
Unique({
  name: 'commerce_outbox_event_workflow_type_unique',
  properties: ['workflowId', 'eventType'],
})(OutboxEvent);
PrimaryKey({ type: 'uuid' })(OutboxEvent.prototype, 'id');
Property({ type: 'uuid' })(OutboxEvent.prototype, 'workflowId');
Property({ length: 100 })(OutboxEvent.prototype, 'eventType');
Property({ type: JsonType })(OutboxEvent.prototype, 'payload');
Property()(OutboxEvent.prototype, 'occurredAt');
Property({ nullable: true })(OutboxEvent.prototype, 'sentAt');
