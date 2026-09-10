alter table inventory.inventory_operation
    add column if not exists projection_status text,
    add column if not exists projection_version bigint,
    add column if not exists projection_reason text,
    add column if not exists projection_updated_at timestamptz;

alter table inventory.inventory_operation
    drop constraint if exists inventory_operation_state_check,
    drop constraint if exists inventory_operation_check,
    drop constraint if exists inventory_operation_projection_check;

alter table inventory.inventory_operation
    add constraint inventory_operation_state_check
        check (state in ('CLAIMED', 'COMPLETED', 'PROJECTION')),
    add constraint inventory_operation_check check (
        (state = 'CLAIMED' and owner_token is not null and lease_until is not null
            and result_event_id is null and projection_status is null)
        or (state = 'COMPLETED' and owner_token is null and lease_until is null
            and result_event_id is not null and projection_status is null)
        or (state = 'PROJECTION' and owner_token is null and lease_until is null
            and result_event_id is null and projection_status is not null)
    ),
    add constraint inventory_operation_projection_check check (
        state <> 'PROJECTION'
        or (projection_status in ('RESERVED', 'REJECTED', 'COMMITTED', 'RELEASED')
            and projection_version > 0 and projection_updated_at is not null
            and ((projection_status = 'REJECTED') = (projection_reason is not null)))
    );
