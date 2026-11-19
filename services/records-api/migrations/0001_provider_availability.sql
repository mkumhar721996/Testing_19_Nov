create table provider_availability (
  provider_id text primary key,
  time_zone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table working_hours (
  provider_id text not null references provider_availability (provider_id),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  primary key (provider_id, weekday)
);

create table days_off (
  provider_id text not null references provider_availability (provider_id),
  day date not null,
  primary key (provider_id, day)
);

create table audit_records (
  id bigserial primary key,
  actor_id text not null,
  action text not null,
  subject text not null,
  occurred_at timestamptz not null default now()
);
