-- Private buyer links for the One Pager (Oct 2026). Each link is a random token (/view/<token>), a passcode
-- stored only as a scrypt hash, and a per-link secret that signs its visitors' cookie. Every opening is
-- logged in share_link_views with a short network fingerprint (not the address) and the browser's user agent.
-- RLS on and no policies: service role only (the owner API and the /view route).

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  secret text not null,
  doc_slug text not null default 'one-pager' references owner_documents (slug) on delete cascade,
  recipient_name text not null,
  recipient_company text not null default '',
  recipient_email text,
  passcode_hash text not null,
  hidden_sections text[] not null default '{offer}',
  expires_at timestamptz not null,
  max_views integer,
  failed_attempts integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists share_link_views (
  id bigint generated always as identity primary key,
  link_id uuid not null references share_links (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);
create index if not exists share_link_views_link_idx on share_link_views (link_id, viewed_at desc);

alter table share_links enable row level security;
alter table share_link_views enable row level security;
revoke all on share_links, share_link_views from anon, authenticated;

-- Oct 28 2026: the passcode itself, encrypted (AES-256-GCM, key derived from the server's service key), so an owner can
-- copy a link's passcode and message again later (Stefan). Links made before this have none: the owner gives them a
-- new passcode. passcode_hash still does the checking.
alter table share_links add column if not exists passcode_enc text;

notify pgrst, 'reload schema';
