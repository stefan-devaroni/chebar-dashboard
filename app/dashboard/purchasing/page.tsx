import { createClient } from '@/lib/supabase/server';
import { InventoryManager } from '@/components/inventory-manager';

export const dynamic = 'force-dynamic';

export default async function PurchasingPage() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from('inventory_items')
    .select('*, supplier:suppliers!inventory_items_supplier_id_fkey(id, name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(id, name)')
    .eq('active', true)
    .order('category')
    .order('name');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Purchasing</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Inventory, par levels, and ordering. Walk the kitchen, update stock, see what to order.
        </p>
      </header>
      <InventoryManager
        initialItems={items ?? []}
        initialSuppliers={suppliers ?? []}
      />
    </div>
  );
}
