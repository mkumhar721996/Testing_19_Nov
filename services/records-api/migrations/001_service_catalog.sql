create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_types_name_uq on service_types (lower(btrim(name)));

-- Minimal read model; creating and pricing offerings belongs to the pricing story.
create table offerings (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  service_type_id uuid not null references service_types(id), -- never deleted, only retired
  price_amount numeric(12,2) not null,
  price_unit text not null check (price_unit in ('per hour','fixed'))
);

create table service_type_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  requested_name text not null,
  created_at timestamptz not null default now()
);

create table audit_records (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  detail jsonb not null default '{}',
  at timestamptz not null default now()
);
