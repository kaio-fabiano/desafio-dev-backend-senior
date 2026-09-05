import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

import type { PaymentMethod } from '../../checkout/checkout.types.ts';
import { OrderWorkflowState } from '../../saga/order-workflow-state.ts';

export { OrderWorkflowState } from '../../saga/order-workflow-state.ts';

@Entity({ tableName: 'order_workflow_order_workflow' })
export class OrderWorkflow {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid', unique: true })
  checkoutOperationId!: string;

  @Property({ type: 'string', length: 32, unique: true })
  wooOrderId!: string;

  @Property({ type: 'json' })
  stockItems!: Array<{ productId: string; quantity: number }>;

  @Property({ type: 'string', length: 8, nullable: true })
  paymentMethod?: PaymentMethod;

  @Property({ type: 'string', length: 32 })
  state = OrderWorkflowState.Created;

  @Property({ type: 'integer', default: 0 })
  version = 0;

  @Property({ type: 'string', length: 255, nullable: true })
  paymentId?: string;

  @Property({ type: 'text', nullable: true })
  pixCode?: string;

  @Property({ type: Date })
  createdAt = new Date();

  @Property({ type: Date, onUpdate: () => new Date() })
  updatedAt = new Date();
}
