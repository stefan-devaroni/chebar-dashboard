import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { OrdersView } from '@/components/orders-view';
import { DeliveriesView } from '@/components/deliveries-view';
import { getSessionInfo } from '@/lib/roles';
import type { PurchaseOrder } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = createClient();
  const session = await getSessionInfo().catch(() => null);
  const isManager = session?.role === 'manager';

  const { data: orders } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isManager) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-3xl">Deliveries</h1>
          <p className="text-sm text-neutral-500 mt-1">
            When a delivery arrives, tap Check and tick off what actually came in.
          </p>
        </header>
        <DeliveriesView initialOrders={((orders ?? []) as PurchaseOrder[]).filter((o) => !o.archived_at)} />
      </div>
    );
  }

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, phone, email')
    .order('name');

  return (
    <div>
      <header className="mb-8">
        <Link href="/dashboard/purchasing" className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-neutral-500 hover:text-ink transition mb-3">
          <ChevronLeft size={14} strokeWidth={1.5} />
          Purchasing
        </Link>
        <h1 className="font-display text-3xl">Orders</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Send each supplier their order, mark it sent, then check it in when it arrives.
        </p>
      </header>
      <OrdersView
        initialOrders={(orders ?? []) as PurchaseOrder[]}
        suppliers={suppliers ?? []}
      />
    </div>
  );
}
