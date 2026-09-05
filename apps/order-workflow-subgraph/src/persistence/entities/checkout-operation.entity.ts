import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/core';

export enum CheckoutOperationStatus {
  PendingWoo = 'PENDING_WOO',
  CreatingWoo = 'CREATING_WOO',
  Completed = 'COMPLETED',
}
@Entity({ tableName: 'order_workflow_checkout_operation' })
export class CheckoutOperation {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', length: 255 })
  subject!: string;

  @Property({ type: 'string', length: 255, unique: true })
  operationKey!: string;

  @Property({ type: 'string', length: 64 })
  commandHash!: string;

  @Enum({ items: () => CheckoutOperationStatus })
  status = CheckoutOperationStatus.PendingWoo;

  @Property({ type: 'string', length: 255, unique: true })
  wooReference!: string;

  @Property({ type: 'string', length: 32, nullable: true })
  wooOrderId?: string;

  @Property({ type: 'uuid', nullable: true })
  ownerToken?: string;

  @Property({ type: Date, nullable: true })
  leaseUntil?: Date;

  @Property({ type: Date })
  createdAt = new Date();

  @Property({ type: Date, onUpdate: () => new Date() })
  updatedAt = new Date();
}
