create table if not exists transaction.checkout_operation (
    operation_id text primary key,
    operation_key text not null,
    subject text not null,
    command_hash char(64) not null,
    woo_reference text not null unique,
    woo_order_id text,
    items jsonb,
    amount numeric(19, 6),
    currency char(3),
    payment_id text not null,
    error_reason text,
    status text not null check (status in ('PENDING_WOO', 'WOO_CREATION_REQUESTED', 'WOO_CONFIRMED', 'COMPLETED', 'FAILED')),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (woo_order_id),
    constraint checkout_operation_subject_operation_key_unique unique (subject, operation_key),
    check ((woo_order_id is null) = (items is null)),
    check ((woo_order_id is null) = (amount is null)),
    check ((woo_order_id is null) = (currency is null))
);

do $$
declare constraint_record record;
begin
    if to_regclass('transaction.checkout_operation') is not null then
        if exists (select 1 from information_schema.columns where table_schema = 'transaction' and table_name = 'checkout_operation' and column_name = 'transaction_id') then
            alter table transaction.checkout_operation rename column transaction_id to operation_id;
        end if;
        alter table transaction.checkout_operation drop constraint if exists checkout_operation_operation_key_key;
        alter table transaction.checkout_operation drop constraint if exists transaction_checkout_operation_operation_key_key;
        for constraint_record in
            select conname from pg_constraint c
             where c.conrelid = 'transaction.checkout_operation'::regclass
               and c.contype = 'u'
               and pg_get_constraintdef(c.oid) like '%(operation_key)%'
        loop
            execute format('alter table transaction.checkout_operation drop constraint if exists %I', constraint_record.conname);
        end loop;
        for constraint_record in
            select indexname from pg_indexes
             where schemaname = 'transaction' and tablename = 'checkout_operation'
               and indexdef like '%(operation_key)%'
        loop
            execute format('drop index if exists transaction.%I', constraint_record.indexname);
        end loop;
        alter table transaction.checkout_operation drop constraint if exists checkout_operation_owner_token_lease_until_check;
        for constraint_record in
            select conname from pg_constraint c join pg_class t on t.oid = c.conrelid
             where t.relname = 'checkout_operation' and c.connamespace = 'transaction'::regnamespace
               and (pg_get_constraintdef(c.oid) like '%status%' or pg_get_constraintdef(c.oid) like '%owner_token%'
                    or pg_get_constraintdef(c.oid) like '%lease_until%')
        loop
            execute format('alter table transaction.checkout_operation drop constraint if exists %I', constraint_record.conname);
        end loop;
        update transaction.checkout_operation
           set status = 'WOO_CREATION_REQUESTED'
         where status = 'CREATING_WOO';
        alter table transaction.checkout_operation drop column if exists owner_token;
        alter table transaction.checkout_operation drop column if exists lease_until;
        alter table transaction.checkout_operation add column if not exists payment_id text;
        alter table transaction.checkout_operation add column if not exists error_reason text;
        update transaction.checkout_operation set payment_id = 'payment:' || operation_id where payment_id is null;
        alter table transaction.checkout_operation alter column payment_id set not null;
        if not exists (
            select 1
              from pg_constraint
             where conrelid = 'transaction.checkout_operation'::regclass
               and contype = 'u'
               and conkey = array[
                   (select attnum from pg_attribute where attrelid = 'transaction.checkout_operation'::regclass and attname = 'subject'),
                   (select attnum from pg_attribute where attrelid = 'transaction.checkout_operation'::regclass and attname = 'operation_key')
               ]::smallint[]
        ) then
            alter table transaction.checkout_operation
                add constraint checkout_operation_subject_operation_key_unique unique (subject, operation_key);
        end if;
        if not exists (select 1 from pg_constraint where conrelid = 'transaction.checkout_operation'::regclass and conname = 'checkout_operation_status_check') then
            alter table transaction.checkout_operation add constraint checkout_operation_status_check check (status in ('PENDING_WOO', 'WOO_CREATION_REQUESTED', 'WOO_CONFIRMED', 'COMPLETED', 'FAILED'));
        end if;
    end if;
end $$;

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
