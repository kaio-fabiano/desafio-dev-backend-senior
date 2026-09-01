import { Migration } from '@mikro-orm/migrations';

export class Migration202609010001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "order_workflow_checkout_operation"
        add column "owner_token" uuid null,
        add column "lease_until" timestamptz null,
        drop constraint "order_workflow_checkout_operation_status_check",
        add constraint "order_workflow_checkout_operation_status_check"
          check ("status" in ('PENDING_WOO', 'CREATING_WOO', 'COMPLETED'));
    `);
    this.addSql(
      `create index "order_workflow_checkout_operation_recovery_index" on "order_workflow_checkout_operation" ("lease_until") where "woo_order_id" is null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'drop index if exists "order_workflow_checkout_operation_recovery_index";',
    );
    this.addSql(
      `update "order_workflow_checkout_operation" set "status" = 'PENDING_WOO' where "status" = 'CREATING_WOO';`,
    );
    this.addSql(`
      alter table "order_workflow_checkout_operation"
        drop constraint "order_workflow_checkout_operation_status_check",
        add constraint "order_workflow_checkout_operation_status_check"
          check ("status" in ('PENDING_WOO', 'COMPLETED')),
        drop column "owner_token",
        drop column "lease_until";
    `);
  }
}
