-- Owner-only documents (Oct 2026): the business summary for prospective buyers ("One Pager" tab).
-- /api/one-pager reads it with the service role after checking that the login is an owner.
-- The HTML is generated outside this repo (~/chebar-sale/build_summary.py) and uploaded with
-- ~/chebar-sale/publish_one_pager.py, so the numbers never land in git.
-- RLS on and no policies: no browser session can read or write it.

create table if not exists owner_documents (
  slug text primary key,
  title text not null,
  html text not null,
  updated_at timestamptz not null default now()
);

alter table owner_documents enable row level security;
revoke all on owner_documents from anon, authenticated;

notify pgrst, 'reload schema';
