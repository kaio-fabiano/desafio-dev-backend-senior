create table inventory_outbox (
    event_id uuid primary key,
    operation_key text not null unique,
    event_type text not null check (event_type in ('stock.reserved', 'stock.reservation-failed')),
    event_version text not null check (event_version = 'v1'),
    order_id text not null,
    reservation_id text,
    reason text,
    occurred_at timestamptz not null,
    check (
        (event_type = 'stock.reserved' and reservation_id is not null and reason is null)
        or (event_type = 'stock.reservation-failed' and reservation_id is null and reason = 'INSUFFICIENT_STOCK')
    )
);

create table inventory_inbox (
    event_id uuid primary key,
    result_event_id uuid not null references inventory_outbox (event_id) deferrable initially deferred,
    received_at timestamptz not null default current_timestamp
);
