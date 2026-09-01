import { Migration } from '@mikro-orm/migrations';

export class Migration202609010004 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "order_workflow_checkout_operation" drop constraint if exists "order_workflow_checkout_operation_subject_key_unique";',
    );
    this.addSql(
      'alter table "order_workflow_checkout_operation" add constraint "order_workflow_checkout_operation_operation_key_unique" unique ("operation_key");',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "order_workflow_checkout_operation" drop constraint if exists "order_workflow_checkout_operation_operation_key_unique";',
    );
    this.addSql(
      'alter table "order_workflow_checkout_operation" add constraint "order_workflow_checkout_operation_subject_key_unique" unique ("subject", "operation_key");',
    );
  }
}
