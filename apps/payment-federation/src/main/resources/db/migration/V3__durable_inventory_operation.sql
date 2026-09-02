create table inventory_operation (
    operation_key text primary key,
    order_id text not null,
    request_fingerprint text not null,
    state text not null check (state in ('CLAIMED', 'COMPLETED')),
    owner_token uuid,
    lease_until timestamptz,
    result_event_id uuid references inventory_outbox (event_id) deferrable initially deferred,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (
        (state = 'CLAIMED' and owner_token is not null and lease_until is not null and result_event_id is null)
        or (state = 'COMPLETED' and owner_token is null and lease_until is null and result_event_id is not null)
    )
);

create index inventory_operation_expired_claim_index
    on inventory_operation (lease_until)
    where state = 'CLAIMED';
