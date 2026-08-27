import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';

export enum CheckoutOperationStatus {
  PendingWoo = 'PENDING_WOO',
  Completed = 'COMPLETED',
}

export class CheckoutOperation {
  id!: string;
  subject!: string;
  operationKey!: string;
  commandHash!: string;
  status = CheckoutOperationStatus.PendingWoo;
  wooReference!: string;
  wooOrderId?: string;
  createdAt = new Date();
  updatedAt = new Date();
}

Entity({ tableName: 'commerce_checkout_operation' })(CheckoutOperation);
Unique({
  name: 'commerce_checkout_operation_subject_key_unique',
  properties: ['subject', 'operationKey'],
})(CheckoutOperation);
PrimaryKey({ type: 'uuid' })(CheckoutOperation.prototype, 'id');
Property({ length: 255 })(CheckoutOperation.prototype, 'subject');
Property({ length: 255 })(CheckoutOperation.prototype, 'operationKey');
Property({ length: 64 })(CheckoutOperation.prototype, 'commandHash');
Enum({ items: () => CheckoutOperationStatus })(
  CheckoutOperation.prototype,
  'status',
);
Property({ length: 255, unique: true })(
  CheckoutOperation.prototype,
  'wooReference',
);
Property({ length: 32, nullable: true })(
  CheckoutOperation.prototype,
  'wooOrderId',
);
Property()(CheckoutOperation.prototype, 'createdAt');
Property({ onUpdate: () => new Date() })(
  CheckoutOperation.prototype,
  'updatedAt',
);
