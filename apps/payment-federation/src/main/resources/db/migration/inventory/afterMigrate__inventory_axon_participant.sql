create table if not exists inventory.inventory_reservation_projection (
    inventory_reservation_id text primary key,
    transaction_id text not null,
    order_id text not null,
    status text not null check (
        status in ('RESERVED', 'REJECTED', 'COMMITTED', 'COMMIT_REJECTED', 'RELEASED')
    ),
    version bigint not null check (version > 0),
    reason text,
    updated_at timestamptz not null,
    check (
        (status in ('REJECTED', 'COMMIT_REJECTED') and reason is not null)
        or (status not in ('REJECTED', 'COMMIT_REJECTED') and reason is null)
    )
);

create index if not exists inventory_reservation_projection_transaction_index
    on inventory.inventory_reservation_projection (transaction_id);

do $migration$
begin
    if exists (
        select 1
          from information_schema.columns
         where table_schema = 'inventory'
           and table_name = 'inventory_operation'
           and column_name = 'projection_status'
    ) then
        execute $sql$
            insert into inventory.inventory_reservation_projection (
                inventory_reservation_id, transaction_id, order_id,
                status, version, reason, updated_at
            )
            select substring(operation_key from 12), request_fingerprint, order_id,
                   projection_status, projection_version, projection_reason, projection_updated_at
              from inventory.inventory_operation
             where state = 'PROJECTION'
            on conflict (inventory_reservation_id) do update
               set transaction_id = excluded.transaction_id,
                   order_id = excluded.order_id,
                   status = excluded.status,
                   version = excluded.version,
                   reason = excluded.reason,
                   updated_at = excluded.updated_at
             where inventory.inventory_reservation_projection.version < excluded.version
        $sql$;
    end if;
end
$migration$;

alter table inventory.inventory_operation
    drop constraint if exists inventory_operation_projection_check,
    drop constraint if exists inventory_operation_check,
    drop constraint if exists inventory_operation_state_check;

delete from inventory.inventory_operation where state = 'PROJECTION';

alter table inventory.inventory_operation
    drop column if exists projection_status,
    drop column if exists projection_version,
    drop column if exists projection_reason,
    drop column if exists projection_updated_at,
    add constraint inventory_operation_state_check
        check (state in ('CLAIMED', 'COMPLETED')),
    add constraint inventory_operation_check check (
        (state = 'CLAIMED' and owner_token is not null and lease_until is not null
            and result_event_id is null)
        or (state = 'COMPLETED' and owner_token is null and lease_until is null
            and result_event_id is not null)
    );
