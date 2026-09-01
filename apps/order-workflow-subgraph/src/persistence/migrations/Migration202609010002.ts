import { Migration } from '@mikro-orm/migrations';

export class Migration202609010002 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "order_workflow_order_workflow" add column "version" integer not null default 0;',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "order_workflow_order_workflow" drop column "version";',
    );
  }
}
