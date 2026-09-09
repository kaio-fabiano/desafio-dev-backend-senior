alter table payment.payment_effect
    drop constraint if exists payment_effect_payment_id_fkey,
    drop constraint if exists payment_effect_effect_type_check,
    drop constraint if exists payment_effect_state_check;

alter table payment.payment_effect
    add column if not exists state text not null default 'COMPLETED',
    add column if not exists idempotency_key text,
    add column if not exists provider_reference text,
    add column if not exists provider_status text,
    add column if not exists pix_code text,
    add column if not exists completed_at timestamptz,
    add constraint payment_effect_effect_type_check check (
        effect_type in (
            'CARD_AUTHORIZATION', 'PIX_CODE_GENERATION', 'REFUND', 'PAYMENT_REJECTION',
            'PROVIDER_PAYMENT', 'PROVIDER_REFUND'
        )
    ),
    add constraint payment_effect_state_check check (state in ('CLAIMED', 'COMPLETED'));

alter table payment.payment_record
    add column if not exists event_sequence bigint not null default 0;
