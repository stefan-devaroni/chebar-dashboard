import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { notifyOwner } from '@/lib/notify';
import {
  deriveOverallStatus,
  fillSupplierStatuses,
  formatQty,
  getSupplierStatus,
  supplierKey,
  type Delivery,
  type DeliveryLine,
  type PurchaseOrder,
} from '@/lib/purchasing';

// Check in one supplier's delivery: what actually arrived vs. what was ordered.
// Open to employees (whoever receives the delivery), unlike the rest of /api/orders.
export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const orderId: string = body.orderId;
  const supplierId: string = body.supplierId;
  const receivedByName: Record<string, number> = {};
  for (const r of body.received ?? []) {
    const qty = Number(r?.qty);
    if (typeof r?.name === 'string' && Number.isFinite(qty)) receivedByName[r.name] = Math.max(0, qty);
  }

  const supabase = createClient();
  const { data } = await supabase.from('purchase_orders').select('*').eq('id', orderId).single();
  const order = data as PurchaseOrder | null;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.archived_at) return NextResponse.json({ error: 'This order is archived' }, { status: 409 });

  const status = getSupplierStatus(order, supplierId);
  if (status === 'received') {
    const by = order.deliveries?.[supplierId]?.received_by;
    return NextResponse.json({ error: `Already checked in${by ? ` by ${by}` : ''}` }, { status: 409 });
  }
  // Employees only see sent orders; managers may also check in one they forgot to mark sent
  if (session.role === 'employee' && status !== 'sent') {
    return NextResponse.json({ error: 'This order has not been sent yet' }, { status: 403 });
  }

  const items = order.items.filter((i) => supplierKey(i) === supplierId);
  if (items.length === 0) return NextResponse.json({ error: 'No items for this supplier' }, { status: 404 });

  const lines: DeliveryLine[] = items.map((i) => ({
    name: i.name,
    unit: i.unit,
    unit_size: i.unit_size,
    ordered: i.toBuy,
    received: receivedByName[i.name] ?? 0,
  }));
  const missing = lines
    .filter((l) => l.received < l.ordered)
    .map((l) => ({ name: l.name, unit: l.unit, unit_size: l.unit_size, qty: +(l.ordered - l.received).toFixed(2) }));

  const delivery: Delivery = {
    received_at: new Date().toISOString(),
    received_by: session.memberName ?? session.email,
    lines,
    missing,
    resolved_at: null,
    resolution: null,
  };

  const statuses = fillSupplierStatuses({ ...(order.supplier_statuses ?? {}), [supplierId]: 'received' }, order.items);
  const { data: updated, error } = await supabase
    .from('purchase_orders')
    .update({
      supplier_statuses: statuses,
      status: deriveOverallStatus(statuses, order.items),
      deliveries: { ...(order.deliveries ?? {}), [supplierId]: delivery },
    })
    .eq('id', order.id)
    .select()
    .single();

  if (error) {
    const needsMigration = error.message.includes('deliveries');
    return NextResponse.json(
      { error: needsMigration ? 'Delivery check-in needs a one-time database update (supabase/purchasing-workflow.sql).' : error.message },
      { status: 500 }
    );
  }

  if (missing.length > 0) {
    const supplierName = items[0].supplier_name || 'a supplier';
    await notifyOwner({
      title: `Missing from ${supplierName} delivery`,
      message: `${missing.map((m) => `• ${formatQty(m, m.qty)}`).join('\n')}\n\nChecked in by ${delivery.received_by}`,
      url: 'https://dashboard.chebararuba.com/dashboard/orders',
    });
  }

  return NextResponse.json(updated);
}
