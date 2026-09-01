import { Migration } from '@mikro-orm/migrations';

export class Migration202608270002 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "commerce_outbox_event"
        add column "publication_attempts" integer not null default 0,
        add column "last_publication_attempt_at" timestamptz null;
    `);

    this.addSql(`
      alter table "commerce_order_workflow"
        add column "payment_id" varchar(255) null,
        add column "pix_code" text null,
        add constraint "commerce_order_workflow_state_check" check (
          "state" in (
            'CREATED', 'PAYMENT_PENDING', 'PAYMENT_AUTHORIZED',
            'STOCK_PENDING', 'COMPLETED', 'STOCK_FAILED', 'REFUND_PENDING',
            'REFUNDED', 'CANCELLED', 'PIX_PENDING', 'PIX_GENERATED'
          )
        );
    `);

    this.addSql(`
      create table "commerce_inbox_record" (
        "event_id" uuid not null,
        "workflow_id" uuid null,
        "event_type" varchar(100) not null,
        "disposition" varchar(16) null,
        "received_at" timestamptz not null default current_timestamp,
        "processed_at" timestamptz null,
        constraint "commerce_inbox_record_pkey" primary key ("event_id"),
        constraint "commerce_inbox_record_disposition_check" check ("disposition" in ('APPLIED', 'IGNORED')),
        constraint "commerce_inbox_record_workflow_foreign" foreign key ("workflow_id") references "commerce_order_workflow" ("id") on update cascade on delete cascade
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "commerce_inbox_record" cascade;');
    this.addSql(`
      alter table "commerce_order_workflow"
        drop constraint "commerce_order_workflow_state_check",
        drop column "payment_id",
        drop column "pix_code";
    `);

    this.addSql(`
      alter table "commerce_outbox_event"
        drop column "publication_attempts",
        drop column "last_publication_attempt_at";
    `);
  }
}
