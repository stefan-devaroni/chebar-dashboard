import { createClient } from '@/lib/supabase/server';
import { BulkEditView } from '@/components/bulk-edit-view';

export const dynamic = 'force-dynamic';

export default async function BulkEditPage() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, unit_size, par_stock, current_stock, station, supplier_id, backup_supplier_id, supplier:suppliers!inventory_items_supplier_id_fkey(id, name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(id, name)')
    .eq('active', true)
    .order('category')
    .order('name');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name');

  return (
    <div>
      <BulkEditView items={(items ?? []) as any} suppliers={(suppliers ?? []) as any} />
    </div>
  );
}
