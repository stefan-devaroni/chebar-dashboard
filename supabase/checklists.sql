-- Daily checklists (Oct 2026). Safe to run more than once.
-- Managers set up lists (opening, closing, shift change...); staff tick items off
-- on their phone each day. One row per checked item per business day.

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null default 'all' check (department in ('all', 'foh', 'kitchen')),
  days int[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday ... 6 = Saturday
  due_time text check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  text text not null,
  sort int not null default 0,
  active boolean not null default true, -- removed items stay so past days still read correctly
  created_at timestamptz not null default now()
);

create table if not exists checklist_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references checklist_items(id) on delete cascade,
  checklist_id uuid not null references checklists(id) on delete cascade,
  date date not null, -- business day (Aruba time, rolls over at 5 AM)
  checked_by text not null,
  checked_by_member uuid,
  checked_at timestamptz not null default now(),
  unique (item_id, date)
);

create index if not exists checklist_items_list_idx on checklist_items (checklist_id, sort);
create index if not exists checklist_checks_date_idx on checklist_checks (date);

-- Only the dashboard server (service role) reads and writes these
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table checklist_checks enable row level security;
revoke all on checklists from anon, authenticated;
revoke all on checklist_items from anon, authenticated;
revoke all on checklist_checks from anon, authenticated;

-- Starter lists, only on the first run. Edit them in the dashboard to match how you work.
do $$
declare l uuid;
begin
  if exists (select 1 from checklists) then
    return;
  end if;

  insert into checklists (name, department, due_time, sort) values ('Opening — Front of House', 'foh', '07:30', 1) returning id into l;
  insert into checklist_items (checklist_id, text, sort) values
    (l, 'Unlock, lights, AC and music on', 1),
    (l, 'Both Revel iPads on and logged in', 2),
    (l, 'Count the starting cash in both drawers', 3),
    (l, 'Coffee machine on, first espresso tested', 4),
    (l, 'Tables, chairs and terrace wiped and set', 5),
    (l, 'Menus clean and on the tables', 6),
    (l, 'Bathrooms clean, with paper and soap', 7),
    (l, 'Juice, fruit and garnishes ready', 8),
    (l, 'Check today''s reservations', 9);

  insert into checklists (name, department, due_time, sort) values ('Opening — Kitchen', 'kitchen', '07:30', 2) returning id into l;
  insert into checklist_items (checklist_id, text, sort) values
    (l, 'Fridge and freezer temperatures checked', 1),
    (l, 'Griddle, stove and ovens on', 2),
    (l, 'Prep list for today done', 3),
    (l, 'Everything labeled and dated', 4),
    (l, 'Sanitizer buckets and towels ready', 5),
    (l, 'Check today''s deliveries', 6);

  insert into checklists (name, department, due_time, sort) values ('3 PM shift change', 'all', '15:15', 3) returning id into l;
  insert into checklist_items (checklist_id, text, sort) values
    (l, 'Z-read printed on both iPads', 1),
    (l, 'Each drawer counted with the manager and the evening bartender', 2),
    (l, 'Difference within 1%? If not, tell the manager', 3),
    (l, 'Tips stay in the drawer', 4),
    (l, 'Cash to the upstairs drop safe', 5),
    (l, 'Evening team briefed: bookings, music, anything special', 6);

  insert into checklists (name, department, due_time, sort) values ('Closing — Front of House', 'foh', '23:30', 4) returning id into l;
  insert into checklist_items (checklist_id, text, sort) values
    (l, 'Last orders done, all tabs closed in Revel', 1),
    (l, 'Z-read printed on both iPads', 2),
    (l, 'Cash counted and in the drop safe', 3),
    (l, 'Bar cleaned and restocked for tomorrow', 4),
    (l, 'Tables wiped, terrace cleared', 5),
    (l, 'Bathrooms checked', 6),
    (l, 'Music, lights and AC off', 7),
    (l, 'Doors locked', 8);

  insert into checklists (name, department, due_time, sort) values ('Closing — Kitchen', 'kitchen', '23:00', 5) returning id into l;
  insert into checklist_items (checklist_id, text, sort) values
    (l, 'Pizza oven off and cleaned', 1),
    (l, 'All food wrapped, labeled and dated', 2),
    (l, 'Fridge and freezer temperatures checked', 3),
    (l, 'Surfaces cleaned, floor swept and mopped', 4),
    (l, 'Trash out', 5),
    (l, 'Gas and equipment off', 6);
end $$;

notify pgrst, 'reload schema';
