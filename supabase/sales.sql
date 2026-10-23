-- Sales tab (Oct 2026): Revel emails a sales report and a product mix report every day to
-- revel@ingest.chebararuba.com (/api/ingest-email). Daily totals go to daily_metrics, item sales to
-- product_sales, and the original files to the private Storage bucket revel-reports.

alter table daily_metrics add column if not exists orders_total integer;

alter table report_ingestions add column if not exists report_date date;
alter table report_ingestions add column if not exists file_path text;

create table if not exists product_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  category text not null default '',
  quantity numeric not null default 0,
  revenue numeric not null default 0,
  ingestion_id uuid,
  created_at timestamptz not null default now(),
  unique (date, name)
);
create index if not exists product_sales_date_idx on product_sales (date);

alter table product_sales enable row level security;
revoke all on product_sales from anon, authenticated;

-- One day's product mix, replaced as a whole: sending the same day's report again overwrites it.
-- Lines with the same name (an item listed under two categories) are added together.
create or replace function replace_product_sales(p_date date, p_items jsonb, p_ingestion uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from product_sales where date = p_date;
  insert into product_sales (date, name, category, quantity, revenue, ingestion_id)
  select p_date, item_name, max(item_category), sum(item_quantity), sum(item_revenue), p_ingestion
  from (
    select trim(i->>'name') as item_name,
           coalesce(trim(i->>'category'), '') as item_category,
           coalesce((i->>'quantity')::numeric, 0) as item_quantity,
           coalesce((i->>'revenue')::numeric, 0) as item_revenue
    from jsonb_array_elements(p_items) as i
  ) lines
  where item_name <> ''
  group by item_name;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Totals per product over a date range, for the Sales tab
create or replace function product_sales_summary(p_from date, p_to date)
returns table (name text, category text, quantity numeric, revenue numeric, days integer)
language sql
stable
security definer
set search_path = public
as $$
  select name, max(category), sum(quantity), sum(revenue), count(distinct date)::integer
  from product_sales
  where date between p_from and p_to
  group by name
  order by sum(revenue) desc, name
$$;

-- How many days in a range have a product mix report
create or replace function product_mix_days(p_from date, p_to date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct date)::integer from product_sales where date between p_from and p_to
$$;

revoke all on function replace_product_sales(date, jsonb, uuid) from public, anon, authenticated;
revoke all on function product_sales_summary(date, date) from public, anon, authenticated;
revoke all on function product_mix_days(date, date) from public, anon, authenticated;
grant execute on function replace_product_sales(date, jsonb, uuid) to service_role;
grant execute on function product_sales_summary(date, date) to service_role;
grant execute on function product_mix_days(date, date) to service_role;

-- Original report files, private (read through the service role only)
insert into storage.buckets (id, name, public, file_size_limit)
values ('revel-reports', 'revel-reports', false, 10485760)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
