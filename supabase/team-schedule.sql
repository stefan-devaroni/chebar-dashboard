-- Run this in Supabase SQL Editor to create team & schedule tables

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'employee' check (role in ('owner','manager','employee')),
  color text not null default '#d4a45c',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  shift_type text not null default 'morning' check (shift_type in ('morning','evening')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists shifts_date_idx on shifts(date);
create index if not exists shifts_member_idx on shifts(team_member_id);

alter table team_members enable row level security;
alter table shifts enable row level security;
create policy "authenticated all team_members" on team_members for all to authenticated using (true) with check (true);
create policy "authenticated all shifts" on shifts for all to authenticated using (true) with check (true);
