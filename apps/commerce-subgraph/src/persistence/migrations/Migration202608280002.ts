import { Migration } from '@mikro-orm/migrations';

export class Migration202608280002 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "commerce_order_workflow" add column "payment_method" varchar(8) null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "commerce_order_workflow" drop column "payment_method";`,
    );
  }
}
