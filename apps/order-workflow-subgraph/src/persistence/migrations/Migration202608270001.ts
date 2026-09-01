import { Migration } from '@mikro-orm/migrations';

export class Migration202608270001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "order_workflow_checkout_operation" (
        "id" uuid not null,
        "subject" varchar(255) not null,
        "operation_key" varchar(255) not null,
        "command_hash" varchar(64) not null,
        "status" varchar(32) not null default 'PENDING_WOO',
        "woo_reference" varchar(255) not null,
        "woo_order_id" varchar(32) null,
        "created_at" timestamptz not null default current_timestamp,
        "updated_at" timestamptz not null default current_timestamp,
        constraint "order_workflow_checkout_operation_pkey" primary key ("id"),
        constraint "order_workflow_checkout_operation_subject_key_unique" unique ("subject", "operation_key"),
        constraint "order_workflow_checkout_operation_woo_reference_unique" unique ("woo_reference"),
        constraint "order_workflow_checkout_operation_status_check" check ("status" in ('PENDING_WOO', 'COMPLETED'))
      );
    `);

    this.addSql(`
      create table "order_workflow_order_workflow" (
        "id" uuid not null,
        "checkout_operation_id" uuid not null,
        "woo_order_id" varchar(32) not null,
        "state" varchar(32) not null default 'CREATED',
        "created_at" timestamptz not null default current_timestamp,
        "updated_at" timestamptz not null default current_timestamp,
        constraint "order_workflow_order_workflow_pkey" primary key ("id"),
        constraint "order_workflow_order_workflow_operation_unique" unique ("checkout_operation_id"),
        constraint "order_workflow_order_workflow_woo_order_unique" unique ("woo_order_id"),
        constraint "order_workflow_order_workflow_operation_foreign" foreign key ("checkout_operation_id") references "order_workflow_checkout_operation" ("id") on update cascade on delete cascade
      );
    `);

    this.addSql(`
      create table "order_workflow_outbox_event" (
        "id" uuid not null,
        "workflow_id" uuid not null,
        "event_type" varchar(100) not null,
        "payload" jsonb not null,
        "occurred_at" timestamptz not null default current_timestamp,
        "sent_at" timestamptz null,
        constraint "order_workflow_outbox_event_pkey" primary key ("id"),
        constraint "order_workflow_outbox_event_workflow_type_unique" unique ("workflow_id", "event_type"),
        constraint "order_workflow_outbox_event_workflow_foreign" foreign key ("workflow_id") references "order_workflow_order_workflow" ("id") on update cascade on delete cascade
      );
    `);

    this.addSql(
      'create index "order_workflow_outbox_event_unsent_index" on "order_workflow_outbox_event" ("occurred_at") where "sent_at" is null;',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "order_workflow_outbox_event" cascade;');
    this.addSql(
      'drop table if exists "order_workflow_order_workflow" cascade;',
    );
    this.addSql(
      'drop table if exists "order_workflow_checkout_operation" cascade;',
    );
  }
}
