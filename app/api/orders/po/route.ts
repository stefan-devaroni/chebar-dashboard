import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionWith } from '@/lib/roles';
import { NO_ACCESS } from '@/lib/permissions';
import { buildPurchaseOrderPdf } from '@/lib/po-pdf';
import { BUYER, groupBySupplier, NO_SUPPLIER, type PoNumber, type PurchaseOrder } from '@/lib/purchasing';

// Purchase order PDF for one supplier's part of an order (Purchasing access). The first time, the
// supplier part gets its own PO number; after that the same number and date are reused.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await sessionWith('purchasing');
  if (!session) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });

  const { orderId, supplierId } = await request.json().catch(() => ({}));
  if (typeof orderId !== 'string' || typeof supplierId !== 'string' || supplierId === NO_SUPPLIER) {
    return NextResponse.json({ error: 'Pick a supplier first' }, { status: 400 });
  }

  const supabase = createClient();
  const { data } = await supabase.from('purchase_orders').select('*').eq('id', orderId).maybeSingle();
  const order = data as PurchaseOrder | null;
  const section = order ? groupBySupplier(order.items).find(([sid]) => sid === supplierId) : undefined;
  if (!order || !section) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: assigned, error } = await supabase.rpc('assign_po_number', { p_order: orderId, p_supplier: supplierId });
  if (error) {
    const setup = /assign_po_number|po_numbers|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: setup ? 'Purchase order numbers need a one-time database update (supabase/purchase-order-numbers.sql).' : error.message },
      { status: setup ? 503 : 500 }
    );
  }
  const po = assigned as PoNumber;

  const { data: supplier } = await supabase.from('suppliers').select('name, contact_name, phone, email').eq('id', supplierId).maybeSingle();
  const [, { supplierName, items }] = section;

  const pdf = buildPurchaseOrderPdf({
    poNumber: po.number,
    issuedAt: po.issued_at,
    buyer: BUYER,
    supplier: { name: supplier?.name ?? supplierName, contactName: supplier?.contact_name, phone: supplier?.phone, email: supplier?.email },
    items: items.map((i) => ({ name: i.name, size: i.unit_size, qty: i.toBuy, unit: i.unit })),
    notes: order.notes,
    orderedBy: session.memberName ?? null,
  });

  const filename = `${po.number} ${supplierName}`.replace(/[^\w .-]+/g, '').trim() + '.pdf';
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-PO-Number': po.number,
      'X-PO-Issued': po.issued_at,
      'Cache-Control': 'no-store',
    },
  });
}
