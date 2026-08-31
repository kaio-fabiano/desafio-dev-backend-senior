create table payment_record (
    payment_id text primary key,
    operation_key text not null unique,
    order_id text not null,
    method text not null check (method in ('CARD', 'PIX')),
    amount numeric not null check (amount > 0),
    currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
    status text not null check (status in ('AUTHORIZED', 'PIX_GENERATED', 'REFUNDED')),
    pix_code text,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (
        (method = 'PIX' and status = 'PIX_GENERATED' and pix_code is not null)
        or (method = 'CARD' and status in ('AUTHORIZED', 'REFUNDED') and pix_code is null)
    )
);

create table payment_effect (
    effect_id uuid primary key,
    payment_id text not null references payment_record (payment_id),
    operation_key text not null,
    effect_type text not null check (effect_type in ('CARD_AUTHORIZATION', 'PIX_CODE_GENERATION', 'REFUND')),
    occurred_at timestamptz not null,
    constraint payment_effect_payment_type_unique unique (payment_id, effect_type),
    constraint payment_effect_operation_type_unique unique (operation_key, effect_type)
);

create table payment_outbox (
    event_id uuid primary key,
    effect_id uuid not null unique references payment_effect (effect_id),
    operation_key text not null,
    event_type text not null check (event_type in ('payment.authorized', 'payment.pix-generated', 'payment.refunded')),
    event_version text not null check (event_version = 'v1'),
    payload jsonb not null,
    occurred_at timestamptz not null,
    publication_attempts integer not null default 0 check (publication_attempts >= 0),
    sent_at timestamptz,
    constraint payment_outbox_operation_type_unique unique (operation_key, event_type)
);

create index payment_outbox_unsent_index
    on payment_outbox (occurred_at)
    where sent_at is null;

create table payment_inbox (
    event_id uuid primary key,
    effect_id uuid not null references payment_effect (effect_id) deferrable initially deferred,
    result_event_id uuid not null references payment_outbox (event_id) deferrable initially deferred,
    received_at timestamptz not null default current_timestamp
);
