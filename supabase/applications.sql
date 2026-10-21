-- Job applications from chebararuba.com/careers + dashboard notifications (Oct 2026). Safe to run more than once.

create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  positions text[] not null default '{}',
  adult boolean,                         -- 18 or older (needed to serve alcohol)
  availability text,                     -- Full-time / Part-time / Either
  shifts text[] not null default '{}',   -- Mornings / Nights / Weekends
  start_date date,
  languages text[] not null default '{}',
  experience text,
  about text,
  cv_path text,                          -- file in the private "applications" storage bucket
  cv_name text,
  cv_size integer,
  status text not null default 'new' check (status in ('new', 'contacted', 'interview', 'hired', 'later', 'not_a_fit')),
  notes text,                            -- manager notes
  ip_hash text,                          -- hashed visitor IP, only for rate limiting
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists job_applications_created_idx on job_applications (created_at desc);
alter table job_applications enable row level security;
revoke all on job_applications from anon, authenticated;

-- The bell in the dashboard (job applications, online bookings, missing deliveries)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz
);
create index if not exists notifications_created_idx on notifications (created_at desc);
alter table notifications enable row level security;
revoke all on notifications from anon, authenticated;

-- CVs: private bucket; only the dashboard server reads them (short-lived signed links for managers)
insert into storage.buckets (id, name, public, file_size_limit)
values ('applications', 'applications', false, 5242880)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
