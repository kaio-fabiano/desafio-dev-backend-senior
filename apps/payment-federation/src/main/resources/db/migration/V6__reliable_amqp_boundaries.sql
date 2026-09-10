create table transaction.amqp_inbox (
    consumer_name text not null,
    event_id uuid not null,
    event_type text not null,
    correlation_id text not null,
    causation_id text not null,
    envelope jsonb not null,
    disposition text not null check (disposition in ('PROCESSING', 'COMPLETED', 'BUSINESS_REJECTED')),
    received_at timestamptz not null default current_timestamp,
    completed_at timestamptz,
    primary key (consumer_name, event_id),
    check (
        (disposition = 'PROCESSING' and completed_at is null)
        or (disposition <> 'PROCESSING' and completed_at is not null)
    )
);

create table inventory.amqp_inbox (like transaction.amqp_inbox including all);
create table payment.amqp_inbox (like transaction.amqp_inbox including all);

create table transaction.amqp_outbox (
    event_id uuid primary key,
    source_event_id text not null unique,
    routing_key text not null,
    envelope jsonb not null,
    occurred_at timestamptz not null,
    publication_attempts integer not null default 0 check (publication_attempts >= 0),
    claimed_by text,
    claim_until timestamptz,
    published_at timestamptz,
    last_error text,
    check ((claimed_by is null) = (claim_until is null))
);

create table inventory.amqp_outbox (like transaction.amqp_outbox including all);
create table payment.amqp_outbox (like transaction.amqp_outbox including all);

create index transaction_amqp_outbox_pending_index
    on transaction.amqp_outbox (occurred_at)
    where published_at is null;
create index inventory_amqp_outbox_pending_index
    on inventory.amqp_outbox (occurred_at)
    where published_at is null;
create index payment_amqp_outbox_pending_index
    on payment.amqp_outbox (occurred_at)
    where published_at is null;
