-- Run this in Supabase SQL Editor to add time-off / availability tracking

create table if not exists time_off (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'approved' check (status in ('requested','approved','denied')),
  created_at timestamptz default now()
);

create index if not exists time_off_member_idx on time_off(team_member_id);
create index if not exists time_off_dates_idx on time_off(start_date, end_date);

alter table time_off enable row level security;
create policy "authenticated all time_off" on time_off for all to authenticated using (true) with check (true);
