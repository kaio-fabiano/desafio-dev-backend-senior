create sequence axon."aggregate-event-global-index-sequence" start with 1 increment by 1;

create table axon.aggregate_event_entry (
    global_index bigint primary key,
    aggregate_type varchar(255),
    aggregate_identifier varchar(255),
    aggregate_sequence_number bigint,
    type varchar(255) not null,
    version varchar(255) not null,
    timestamp varchar(255) not null,
    payload oid not null,
    metadata oid,
    identifier varchar(255) not null,
    constraint aggregate_event_entry_stream_version_unique
        unique (aggregate_identifier, aggregate_sequence_number)
);

create table axon.token_entry (
    processor_name varchar(255) not null,
    segment integer not null,
    mask integer not null,
    token oid,
    token_type varchar(255),
    timestamp varchar(255) not null,
    owner varchar(255),
    primary key (processor_name, segment)
);

create table axon.persistence_probe_projection (
    event_identifier varchar(255) primary key,
    handled_count integer not null check (handled_count = 1)
);
