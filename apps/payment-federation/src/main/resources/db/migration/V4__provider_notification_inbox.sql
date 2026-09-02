create table provider_notification_inbox (
    provider_request_id text primary key,
    provider_reference text not null,
    authoritative_status text not null check (
        authoritative_status in ('PENDING', 'AUTHORIZED', 'PIX_GENERATED', 'REFUNDED', 'REJECTED')
    ),
    processing_outcome text check (
        processing_outcome in ('APPLIED', 'DUPLICATE', 'NO_CHANGE', 'IGNORED')
    ),
    received_at timestamptz not null,
    processed_at timestamptz,
    check (
        (processing_outcome is null and processed_at is null)
        or (processing_outcome is not null and processed_at is not null)
    )
);

create index provider_notification_inbox_reference_index
    on provider_notification_inbox (provider_reference, received_at);
