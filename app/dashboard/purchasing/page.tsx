import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { InventoryManager } from '@/components/inventory-manager';
import { openMissing, type PurchaseOrder } from '@/lib/purchasing';

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

  const { data: orders } = await supabase.from('purchase_orders').select('*');
  const issues = openMissing((orders ?? []) as PurchaseOrder[]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Purchasing</h1>
      </header>
      {issues.length > 0 && (
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-5 text-sm hover:bg-red-100 transition"
        >
          <AlertTriangle size={16} strokeWidth={2} className="shrink-0" />
          <span className="flex-1">
            {issues.length === 1
              ? `${issues[0].supplierName} delivery was missing ${issues[0].delivery.missing.length} item${issues[0].delivery.missing.length !== 1 ? 's' : ''}`
              : `${issues.length} deliveries had missing items`}
          </span>
          <span className="text-xs uppercase tracking-widest shrink-0">Review →</span>
        </Link>
      )}
      <InventoryManager
        initialItems={items ?? []}
        initialSuppliers={suppliers ?? []}
      />
    </div>
  );
}
