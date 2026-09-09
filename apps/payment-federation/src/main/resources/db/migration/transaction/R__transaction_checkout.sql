create table if not exists transaction.checkout_operation (
    transaction_id text primary key,
    operation_key text not null unique,
    subject text not null,
    command_hash char(64) not null,
    woo_reference text not null unique,
    woo_order_id text,
    items jsonb,
    amount numeric(19, 6),
    currency char(3),
    status text not null check (status in ('PENDING_WOO', 'CREATING_WOO', 'WOO_CONFIRMED', 'COMPLETED')),
    owner_token uuid,
    lease_until timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (woo_order_id),
    check ((owner_token is null) = (lease_until is null)),
    check ((woo_order_id is null) = (items is null)),
    check ((woo_order_id is null) = (amount is null)),
    check ((woo_order_id is null) = (currency is null))
);

create table if not exists transaction.transaction_view (
    transaction_id text primary key,
    operation_key text not null unique,
    owner_subject text not null,
    woo_order_id text not null unique,
    amount numeric(19, 6) not null check (amount > 0),
    currency char(3) not null,
    payment_method text not null check (payment_method in ('CARD', 'PIX')),
    status text not null,
    outcome_reference text,
    version integer not null check (version > 0),
    updated_at timestamptz not null
);

create index if not exists transaction_checkout_operation_lease_index
    on transaction.checkout_operation (lease_until)
    where status <> 'COMPLETED';
