-- Run in Supabase SQL Editor. Adds archiving for purchase orders. Safe to run twice.
alter table purchase_orders add column if not exists archived_at timestamptz;
