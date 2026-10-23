-- Marketing tab (Oct 2026): Facebook + Instagram numbers read with the read-only Meta system-user key
-- (META_ACCESS_TOKEN). Synced posts go into the existing social_posts table, daily account numbers
-- into social_daily, and every sync run is logged in meta_sync_log (what worked, what Meta refused).

alter table social_posts add column if not exists external_id text;
alter table social_posts add column if not exists permalink text;
alter table social_posts add column if not exists posted_at timestamptz;
alter table social_posts add column if not exists views integer;
alter table social_posts add column if not exists saves integer;
alter table social_posts add column if not exists synced_at timestamptz;
create unique index if not exists social_posts_external_id_key on social_posts (external_id);

create table if not exists social_daily (
  date date not null,
  platform text not null check (platform in ('facebook', 'instagram')),
  followers integer,
  new_followers integer,
  reach integer,
  views integer,
  profile_views integer,
  engagements integer,
  updated_at timestamptz not null default now(),
  primary key (date, platform)
);

create table if not exists meta_sync_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  trigger text,
  ok boolean not null,
  summary jsonb,
  error text
);
create index if not exists meta_sync_log_ran_at_idx on meta_sync_log (ran_at desc);

alter table social_daily enable row level security;
alter table meta_sync_log enable row level security;
revoke all on social_daily, meta_sync_log from anon, authenticated;

notify pgrst, 'reload schema';
