-- Che Bar Dashboard — Database Schema
-- Run this in your Supabase SQL Editor (Project → SQL Editor → New query)
-- After running, run seed.sql to populate tasks from the master plan.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order int not null default 0,
  icon text,
  created_at timestamptz default now()
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  slug text not null,
  display_order int not null default 0,
  description text,
  created_at timestamptz default now(),
  unique (category_id, slug)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references subcategories(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  assignee_email text,
  due_date date,
  notes text,
  display_order int not null default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_email text not null,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

create table if not exists daily_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  revenue_total numeric,
  revenue_breakfast numeric,
  revenue_lunch numeric,
  revenue_dinner numeric,
  covers_total int,
  covers_breakfast int,
  covers_lunch int,
  covers_dinner int,
  labor_cost numeric,
  music_night boolean default false,
  musician_name text,
  musician_fee numeric,
  notes text,
  entered_by text,
  created_at timestamptz default now()
);

create table if not exists reviews_snapshot (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  platform text not null check (platform in ('google','tripadvisor','yelp')),
  rating numeric,
  total_reviews int,
  created_at timestamptz default now(),
  unique (date, platform)
);

-- Report ingestion log (tracks emails received from Revel POS)
create table if not exists report_ingestions (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz default now(),
  sender_email text,
  subject text,
  report_type text check (report_type in ('daily_sales','product_mix','unknown')),
  status text not null default 'pending' check (status in ('pending','processed','failed','skipped')),
  file_name text,
  records_written int default 0,
  error_message text,
  ai_summary text,
  raw_data text
);

create index if not exists report_ingestions_received_idx on report_ingestions(received_at desc);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists tasks_subcategory_idx on tasks(subcategory_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_assignee_idx on tasks(assignee_email);
create index if not exists subcategories_category_idx on subcategories(category_id);
create index if not exists daily_metrics_date_idx on daily_metrics(date desc);

-- ============================================================================
-- Trigger: when task status changes to 'done', set completed_at
-- ============================================================================

create or replace function set_completed_at()
returns trigger as $$
begin
  if NEW.status = 'done' and (OLD.status is null or OLD.status <> 'done') then
    NEW.completed_at = now();
  elsif NEW.status <> 'done' then
    NEW.completed_at = null;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_completed_at on tasks;
create trigger tasks_set_completed_at
  before update on tasks
  for each row execute function set_completed_at();

-- ============================================================================
-- Row Level Security
-- All authenticated users (signed in via Supabase Auth) can read and modify.
-- Restrict to your team using Supabase Auth allowlist or env var checks.
-- ============================================================================

alter table categories enable row level security;
alter table subcategories enable row level security;
alter table tasks enable row level security;
alter table task_activity enable row level security;
alter table daily_metrics enable row level security;
alter table reviews_snapshot enable row level security;

-- Policies: authenticated users can do anything
create policy "authenticated read categories" on categories for select to authenticated using (true);
create policy "authenticated read subcategories" on subcategories for select to authenticated using (true);
create policy "authenticated all tasks" on tasks for all to authenticated using (true) with check (true);
create policy "authenticated all task_activity" on task_activity for all to authenticated using (true) with check (true);
create policy "authenticated all daily_metrics" on daily_metrics for all to authenticated using (true) with check (true);
create policy "authenticated all reviews_snapshot" on reviews_snapshot for all to authenticated using (true) with check (true);

alter table report_ingestions enable row level security;
create policy "authenticated all report_ingestions" on report_ingestions for all to authenticated using (true) with check (true);
