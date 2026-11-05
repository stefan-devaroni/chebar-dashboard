-- Candidates from the Pavilion virtual job fair (Nov 2026) live in job_applications next to the careers page ones.
-- An hourly Claude task on Stefan's computer reads the fair's vendor portal and writes here with the service key.
-- Safe to run more than once.

alter table job_applications add column if not exists source text not null default 'careers';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_applications_source_check') then
    alter table job_applications add constraint job_applications_source_check check (source in ('careers', 'job_fair'));
  end if;
end $$;

-- The portal's own key for a person (a name slug), so the hourly check never adds someone twice
alter table job_applications add column if not exists external_id text;
create unique index if not exists job_applications_source_external_idx
  on job_applications (source, external_id) where external_id is not null;

-- Claude's review from the application form and CV:
-- { summary, facts: [{k, v}], ask: [text], interview, best: position, fit: { position: { pick, take } } }
-- pick is one of top / strong / maybe / wait / no
alter table job_applications add column if not exists review jsonb;

-- One row per hourly look at the portal, so the Applicants page can say when it last checked
create table if not exists job_fair_checks (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  entries integer,
  people integer,
  added text[] not null default '{}',
  note text
);
create index if not exists job_fair_checks_checked_idx on job_fair_checks (checked_at desc);
alter table job_fair_checks enable row level security;
revoke all on job_fair_checks from anon, authenticated;

notify pgrst, 'reload schema';
