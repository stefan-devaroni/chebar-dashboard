-- Run once in Supabase SQL Editor. Safe to run more than once.

-- Archive past orders (replaces orders-archive.sql)
alter table purchase_orders add column if not exists archived_at timestamptz;

-- Delivery check-ins, keyed by supplier id:
-- { received_at, received_by, lines: [{name, unit, unit_size, ordered, received}],
--   missing: [{name, unit, unit_size, qty}], resolved_at, resolution }
alter table purchase_orders add column if not exists deliveries jsonb not null default '{}'::jsonb;
