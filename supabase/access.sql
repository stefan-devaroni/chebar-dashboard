-- Per-person dashboard access (Oct 2026). On the Team tab an owner ticks, per team member, which parts
-- of the dashboard they may use. team_members.access holds that list; null = the role's default.
-- lib/permissions.ts is the source of truth for what each permission opens.
--
-- Applied in two steps: part 1 is additive (safe with the old code), part 2 locks the tables and was
-- applied after the code that reads current_member() was live.

-- ── Part 1 ────────────────────────────────────────────────────────────────────────────────────────

alter table team_members add column if not exists access text[];

-- The team member signed in with this session (matched by email). The middleware reads it this way
-- because team_members itself is not readable with a user session (part 2).
create or replace function public.current_member()
returns table (id uuid, name text, role text, active boolean, access text[])
language sql stable security definer set search_path = public
as $$
  select tm.id, tm.name, tm.role, tm.active, tm.access
  from team_members tm
  where tm.email is not null and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by tm.created_at
  limit 1
$$;
revoke all on function public.current_member() from public, anon;
grant execute on function public.current_member() to authenticated;

-- May the signed-in team member use this part of the dashboard? Mirrors resolvePermissions in
-- lib/permissions.ts: owners everything, no list = role default (managers everything, staff the
-- STAFF_DEFAULT list, keep it the same as there), "x.edit" includes "x", purchasing includes deliveries.
create or replace function public.dashboard_can(perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(bool_or(
    case
      when m.active is false then false
      when m.role = 'owner' then true
      when m.access is null then m.role = 'manager'
        or perm = any (array['checklists', 'deliveries', 'schedule', 'reservations', 'menu', 'handbook'])
      else perm = any (m.access)
        or exists (select 1 from unnest(m.access) a where split_part(a, '.', 1) = perm)
        or (perm = 'deliveries' and 'purchasing' = any (m.access))
    end), false)
  from current_member() m
$$;
revoke all on function public.dashboard_can(text) from public, anon;
grant execute on function public.dashboard_can(text) to authenticated;

-- ── Part 2 ────────────────────────────────────────────────────────────────────────────────────────
-- Until now any signed-in user could read and write these tables directly. The dashboard's server
-- code uses the service role (no policies needed), so only what the browser itself does stays open:
-- the Tasks page (tasks) and the Metrics and Music pages (daily_metrics), for those with that access.

drop policy if exists "authenticated all content_drafts" on content_drafts;
drop policy if exists "authenticated all daily_metrics" on daily_metrics;
drop policy if exists "authenticated all inventory_items" on inventory_items;
drop policy if exists "authenticated all marketing_campaigns" on marketing_campaigns;
drop policy if exists "authenticated all report_ingestions" on report_ingestions;
drop policy if exists "authenticated all reviews_snapshot" on reviews_snapshot;
drop policy if exists "authenticated all shifts" on shifts;
drop policy if exists "authenticated all social_posts" on social_posts;
drop policy if exists "authenticated all suppliers" on suppliers;
drop policy if exists "authenticated all task_activity" on task_activity;
drop policy if exists "authenticated all tasks" on tasks;
drop policy if exists "authenticated all team_members" on team_members;
drop policy if exists "authenticated all time_off" on time_off;
drop policy if exists "authenticated read categories" on categories;
drop policy if exists "authenticated read subcategories" on subcategories;

revoke all on content_drafts, inventory_items, marketing_campaigns, report_ingestions, reviews_snapshot,
  shifts, social_posts, suppliers, task_activity, team_members, time_off, categories, subcategories,
  purchase_orders, stock_changes
  from anon, authenticated;
revoke all on tasks, daily_metrics from anon;

drop policy if exists "dashboard tasks" on tasks;
create policy "dashboard tasks" on tasks for all to authenticated
  using (dashboard_can('tasks')) with check (dashboard_can('tasks'));

drop policy if exists "dashboard daily_metrics" on daily_metrics;
create policy "dashboard daily_metrics" on daily_metrics for all to authenticated
  using (dashboard_can('sales')) with check (dashboard_can('sales'));
