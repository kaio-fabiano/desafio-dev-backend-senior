import { Migration } from '@mikro-orm/migrations';

export class Migration202609010003 extends Migration {
  override async up(): Promise<void> {
    for (const table of [
      'checkout_operation',
      'order_workflow',
      'inbox_record',
      'outbox_event',
    ]) {
      this.addSql(
        `alter table "commerce_${table}" rename to "order_workflow_${table}";`,
      );
    }
  }

  override async down(): Promise<void> {
    for (const table of [
      'checkout_operation',
      'order_workflow',
      'inbox_record',
      'outbox_event',
    ]) {
      this.addSql(
        `alter table "order_workflow_${table}" rename to "commerce_${table}";`,
      );
    }
  }
}
