alter table payment.payment_record
    drop constraint if exists payment_record_status_check,
    drop constraint if exists payment_record_method_status_check,
    add constraint payment_record_status_check check (
        status in ('PENDING', 'AUTHORIZED', 'PIX_GENERATED', 'PIX_PAID', 'REFUNDED', 'REJECTED')
    ),
    add constraint payment_record_method_status_check check (
        (method = 'CARD' and status in ('PENDING', 'AUTHORIZED', 'REFUNDED', 'REJECTED'))
        or (method = 'PIX' and status in ('PENDING', 'PIX_GENERATED', 'PIX_PAID', 'REJECTED'))
    );

alter table payment.payment_effect
    drop constraint if exists payment_effect_effect_type_check,
    add constraint payment_effect_effect_type_check check (
        effect_type in (
            'CARD_AUTHORIZATION', 'PIX_CODE_GENERATION', 'PIX_PAYMENT_CONFIRMATION', 'REFUND', 'PAYMENT_REJECTION',
            'PROVIDER_PAYMENT', 'PROVIDER_REFUND'
        )
    );

alter table payment.payment_outbox
    drop constraint if exists payment_outbox_event_type_check,
    add constraint payment_outbox_event_type_check check (
        event_type in ('payment.authorized', 'payment.pix-generated', 'payment.pix-paid', 'payment.refunded', 'payment.failed')
    );

alter table payment.provider_notification_inbox
    drop constraint if exists provider_notification_inbox_authoritative_status_check,
    add constraint provider_notification_inbox_authoritative_status_check check (
        authoritative_status in ('PENDING', 'AUTHORIZED', 'PIX_GENERATED', 'PIX_PAID', 'REFUNDED', 'REJECTED')
    );
