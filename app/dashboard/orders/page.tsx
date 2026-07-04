import { createClient } from '@/lib/supabase/server';
import { OrdersView } from '@/components/orders-view';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name');

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Orders</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Saved purchase orders grouped by supplier. Review and send.
        </p>
      </header>
      <OrdersView
        initialOrders={orders ?? []}
        suppliers={suppliers ?? []}
      />
    </div>
  );
}
