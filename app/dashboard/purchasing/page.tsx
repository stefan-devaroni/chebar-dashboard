import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { InventoryManager } from '@/components/inventory-manager';
import { openMissing, stageCounts, type PurchaseOrder } from '@/lib/purchasing';

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
  const allOrders = (orders ?? []) as PurchaseOrder[];
  const issues = openMissing(allOrders);
  const { toSend, waiting } = stageCounts(allOrders);
  const openCount = toSend + waiting;

  return (
    <div className="max-w-2xl">
      <header className="flex items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-3xl">Purchasing</h1>
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium hover:border-neutral-400 transition"
        >
          Orders
          {openCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-ink text-cream text-[11px] font-semibold flex items-center justify-center">
              {openCount}
            </span>
          )}
          <ChevronRight size={16} strokeWidth={1.75} className="text-neutral-400" />
        </Link>
      </header>
      {issues.length > 0 && (
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-5 text-sm hover:bg-red-100 transition"
        >
          <AlertTriangle size={16} strokeWidth={2} className="shrink-0" />
          <span className="flex-1">
            {issues.length === 1
              ? `${issues[0].supplierName} delivery was missing ${issues[0].delivery.missing.length} item${issues[0].delivery.missing.length !== 1 ? 's' : ''}`
              : `${issues.length} deliveries had missing items`}
          </span>
          <ChevronRight size={16} strokeWidth={1.75} className="shrink-0" />
        </Link>
      )}
      <InventoryManager
        initialItems={items ?? []}
        initialSuppliers={suppliers ?? []}
      />
    </div>
  );
}
