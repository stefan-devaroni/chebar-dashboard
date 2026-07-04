-- Add per-supplier status tracking to purchase orders
-- supplier_statuses is a jsonb object: { "supplier_id": "draft"|"sent"|"received", ... }
-- When null, falls back to the order-level status for backwards compat
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_statuses jsonb DEFAULT '{}'::jsonb;
