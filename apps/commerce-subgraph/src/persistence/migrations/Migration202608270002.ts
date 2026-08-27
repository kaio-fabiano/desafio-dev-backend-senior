import { Migration } from '@mikro-orm/migrations';

export class Migration202608270002 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "commerce_outbox_event"
        add column "publication_attempts" integer not null default 0,
        add column "last_publication_attempt_at" timestamptz null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "commerce_outbox_event"
        drop column "publication_attempts",
        drop column "last_publication_attempt_at";
    `);
  }
}
