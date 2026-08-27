import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

import { OrderWorkflowState } from '../../saga/order-saga.ts';

export { OrderWorkflowState } from '../../saga/order-saga.ts';

export class OrderWorkflow {
  id!: string;
  checkoutOperationId!: string;
  wooOrderId!: string;
  state = OrderWorkflowState.Created;
  paymentId?: string;
  pixCode?: string;
  createdAt = new Date();
  updatedAt = new Date();
}

Entity({ tableName: 'commerce_order_workflow' })(OrderWorkflow);
PrimaryKey({ type: 'uuid' })(OrderWorkflow.prototype, 'id');
Property({ type: 'uuid', unique: true })(
  OrderWorkflow.prototype,
  'checkoutOperationId',
);
Property({ length: 32, unique: true })(OrderWorkflow.prototype, 'wooOrderId');
Property({ length: 32 })(OrderWorkflow.prototype, 'state');
Property({ length: 255, nullable: true })(OrderWorkflow.prototype, 'paymentId');
Property({ type: 'text', nullable: true })(OrderWorkflow.prototype, 'pixCode');
Property()(OrderWorkflow.prototype, 'createdAt');
Property({ onUpdate: () => new Date() })(OrderWorkflow.prototype, 'updatedAt');
