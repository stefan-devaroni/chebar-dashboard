-- Add station tag to inventory items (bar, kitchen, or both)
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS station text NOT NULL DEFAULT 'both'
CHECK (station IN ('bar', 'kitchen', 'both'));

-- Stock change log for accountability
CREATE TABLE IF NOT EXISTS stock_changes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value numeric NOT NULL,
  new_value numeric NOT NULL,
  changed_at timestamptz DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_stock_changes_item ON stock_changes(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_changes_time ON stock_changes(changed_at DESC);

-- Allow service role full access (RLS bypass)
ALTER TABLE stock_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON stock_changes FOR ALL TO service_role USING (true) WITH CHECK (true);
