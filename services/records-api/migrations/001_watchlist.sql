create table if not exists watchlist_tickers (
  symbol text primary key,
  created_at timestamptz not null default now()
);

create table if not exists audit_records (
  id bigserial primary key,
  action text not null,
  subject text not null,
  actor text not null,
  at timestamptz not null default now()
);
