import { Migration } from '@mikro-orm/migrations';

export class Migration202609010003 extends Migration {
  override async up(): Promise<void> {
    this.renameTables('commerce', 'order_workflow');
  }

  override async down(): Promise<void> {
    this.renameTables('order_workflow', 'commerce');
  }

  private renameTables(
    sourcePrefix: 'commerce' | 'order_workflow',
    targetPrefix: 'commerce' | 'order_workflow',
  ): void {
    for (const table of [
      'checkout_operation',
      'order_workflow',
      'inbox_record',
      'outbox_event',
    ]) {
      const source = `${sourcePrefix}_${table}`;
      const target = `${targetPrefix}_${table}`;

      this.addSql(
        `do $$ begin
          if to_regclass('${source}') is not null
             and to_regclass('${target}') is null then
            alter table "${source}" rename to "${target}";
          end if;
        end $$;`,
      );
    }
  }
}
