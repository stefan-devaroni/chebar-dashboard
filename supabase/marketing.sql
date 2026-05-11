-- Run this in Supabase SQL Editor to create marketing tables

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram','facebook','tiktok','google')),
  post_date date not null default current_date,
  post_type text not null default 'organic' check (post_type in ('organic','paid','story','reel')),
  caption text,
  image_url text,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  reach int default 0,
  impressions int default 0,
  link_clicks int default 0,
  ad_spend numeric default 0,
  ad_revenue numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create index if not exists social_posts_date_idx on social_posts(post_date desc);
create index if not exists social_posts_platform_idx on social_posts(platform);

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null,
  start_date date not null,
  end_date date,
  budget numeric default 0,
  spent numeric default 0,
  impressions int default 0,
  clicks int default 0,
  conversions int default 0,
  revenue numeric default 0,
  status text not null default 'active' check (status in ('draft','active','paused','ended')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  platform text,
  caption text not null,
  image_prompt text,
  image_url text,
  status text not null default 'draft' check (status in ('draft','scheduled','posted')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  created_at timestamptz default now()
);

alter table social_posts enable row level security;
alter table marketing_campaigns enable row level security;
alter table content_drafts enable row level security;
create policy "authenticated all social_posts" on social_posts for all to authenticated using (true) with check (true);
create policy "authenticated all marketing_campaigns" on marketing_campaigns for all to authenticated using (true) with check (true);
create policy "authenticated all content_drafts" on content_drafts for all to authenticated using (true) with check (true);
