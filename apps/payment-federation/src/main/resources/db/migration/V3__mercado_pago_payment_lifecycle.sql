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

alter table payment_record
    add column provider_reference text;

update payment_record
   set provider_reference = 'deterministic:' || operation_key
 where provider_reference is null;

alter table payment_record
    alter column provider_reference set not null,
    add constraint payment_record_provider_reference_unique unique (provider_reference),
    drop constraint if exists payment_record_status_check,
    drop constraint if exists payment_record_check,
    add constraint payment_record_status_check check (
        status in ('PENDING', 'AUTHORIZED', 'PIX_GENERATED', 'REFUNDED', 'REJECTED')
    ),
    add constraint payment_record_method_status_check check (
        (method = 'CARD' and status in ('PENDING', 'AUTHORIZED', 'REFUNDED', 'REJECTED'))
        or (method = 'PIX' and status in ('PENDING', 'PIX_GENERATED', 'REJECTED'))
    ),
    add constraint payment_record_pix_code_check check (
        (status = 'PIX_GENERATED' and pix_code is not null)
        or (status <> 'PIX_GENERATED' and pix_code is null)
    );

alter table payment_effect
    drop constraint if exists payment_effect_effect_type_check,
    add constraint payment_effect_effect_type_check check (
        effect_type in ('CARD_AUTHORIZATION', 'PIX_CODE_GENERATION', 'REFUND', 'PAYMENT_REJECTION')
    );

alter table payment_outbox
    drop constraint if exists payment_outbox_event_type_check,
    add constraint payment_outbox_event_type_check check (
        event_type in ('payment.authorized', 'payment.pix-generated', 'payment.refunded', 'payment.failed')
    );

alter table payment_inbox
    alter column effect_id drop not null,
    alter column result_event_id drop not null,
    add column payment_id text references payment_record (payment_id) deferrable initially deferred;
