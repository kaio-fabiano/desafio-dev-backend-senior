import { Migration } from '@mikro-orm/migrations';

export class Migration202608280001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "commerce_order_workflow" add column "stock_items" jsonb not null default '[]'::jsonb;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "commerce_order_workflow" drop column "stock_items";`);
  }
}
