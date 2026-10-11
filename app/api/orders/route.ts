import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deriveOverallStatus, fillSupplierStatuses, supplierKey, type OrderItem, type PurchaseOrder } from '@/lib/purchasing';

type Supabase = ReturnType<typeof createClient>;

// Add items to the most recent open draft, or start a new order.
// Items for suppliers already sent/received in that draft overflow into a new order.
async function addItemsToDraft(supabase: Supabase, newItems: OrderItem[], notes?: string | null) {
  const bySupplier: Record<string, OrderItem[]> = {};
  for (const item of newItems) (bySupplier[supplierKey(item)] ??= []).push(item);

  const { data: drafts } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(10);

  // Never merge into an archived draft — new items would disappear from view
  const existingDraft = (drafts as PurchaseOrder[] | null)?.find((d) => !d.archived_at);

  if (existingDraft) {
    const existingStatuses: Record<string, string> = existingDraft.supplier_statuses ?? {};
    const mergeItems: OrderItem[] = [];
    const overflowItems: OrderItem[] = [];

    for (const [sid, items] of Object.entries(bySupplier)) {
      const st = existingStatuses[sid];
      if (st === 'sent' || st === 'received') overflowItems.push(...items);
      else mergeItems.push(...items);
    }

    if (mergeItems.length > 0) {
      const merged = [...(existingDraft.items ?? [])];
      for (const newItem of mergeItems) {
        const existing = merged.find((m) => m.name === newItem.name && m.supplier_id === newItem.supplier_id);
        if (existing) existing.toBuy += newItem.toBuy;
        else merged.push(newItem);
      }
      const updatedStatuses = { ...existingStatuses };
      for (const item of mergeItems) updatedStatuses[supplierKey(item)] ??= 'draft';

      const { error } = await supabase
        .from('purchase_orders')
        .update({ items: merged, supplier_statuses: updatedStatuses })
        .eq('id', existingDraft.id);
      if (error) return { error: error.message };
    }

    if (overflowItems.length > 0) {
      const overflowStatuses: Record<string, string> = {};
      for (const item of overflowItems) overflowStatuses[supplierKey(item)] = 'draft';
      const { error } = await supabase
        .from('purchase_orders')
        .insert({ items: overflowItems, status: 'draft', supplier_statuses: overflowStatuses });
      if (error) return { error: error.message };
    }

    return { merged: true, id: existingDraft.id };
  }

  const supplierStatuses: Record<string, string> = {};
  for (const item of newItems) supplierStatuses[supplierKey(item)] = 'draft';

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({ items: newItems, notes: notes || null, status: 'draft', supplier_statuses: supplierStatuses })
    .select()
    .single();
  if (error) return { error: error.message };
  return { merged: false, id: data.id };
}

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const result = await addItemsToDraft(supabase, body.items ?? [], body.notes);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

async function loadOrder(supabase: Supabase, id: string) {
  const { data } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
  return data as PurchaseOrder | null;
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  // Archive / restore one or more orders
  if (body.archived !== undefined) {
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ archived_at: body.archived ? new Date().toISOString() : null })
      .in('id', ids)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Close a "not delivered" issue: re-order the missing items, or just dismiss it
  if (body.resolve_missing !== undefined) {
    const order = await loadOrder(supabase, body.id);
    const delivery = order?.deliveries?.[body.supplier_id];
    if (!order || !delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

    const resolution = body.resolve_missing === 'reordered' ? 'reordered' : 'dismissed';
    if (resolution === 'reordered' && delivery.missing.length > 0) {
      const source = order.items.find((i) => supplierKey(i) === body.supplier_id);
      const reorderItems: OrderItem[] = delivery.missing.map((m) => ({
        name: m.name,
        unit: m.unit,
        unit_size: m.unit_size,
        toBuy: m.qty,
        supplier_name: source?.supplier_name ?? 'No supplier assigned',
        supplier_id: source?.supplier_id ?? null,
      }));
      const result = await addItemsToDraft(supabase, reorderItems);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const deliveries = {
      ...order.deliveries,
      [body.supplier_id]: { ...delivery, resolved_at: new Date().toISOString(), resolution },
    };
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ deliveries })
      .eq('id', order.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Undo a check-in (e.g. done by mistake): back to "sent", delivery record removed
  if (body.undo_receive) {
    const order = await loadOrder(supabase, body.id);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const statuses = fillSupplierStatuses({ ...(order.supplier_statuses ?? {}), [body.supplier_id]: 'sent' }, order.items);
    const deliveries = { ...(order.deliveries ?? {}) };
    delete deliveries[body.supplier_id];

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ supplier_statuses: statuses, status: deriveOverallStatus(statuses, order.items), deliveries })
      .eq('id', order.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Remove one supplier's part of an order (e.g. added by mistake); an empty order is deleted
  if (body.remove_supplier !== undefined) {
    const order = await loadOrder(supabase, body.id);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const items = order.items.filter((i) => supplierKey(i) !== body.remove_supplier);
    if (items.length === 0) {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ deleted: true });
    }

    const statuses = { ...(order.supplier_statuses ?? {}) };
    delete statuses[body.remove_supplier];
    const update: Record<string, unknown> = { items, supplier_statuses: statuses, status: deriveOverallStatus(statuses, items) };
    if (order.deliveries) {
      const deliveries = { ...order.deliveries };
      delete deliveries[body.remove_supplier];
      update.deliveries = deliveries;
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(update)
      .eq('id', order.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Per-supplier status update (mark sent / back to draft)
  if (body.supplier_id !== undefined && body.supplier_status !== undefined) {
    const order = await loadOrder(supabase, body.id);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const statuses = fillSupplierStatuses({ ...(order.supplier_statuses ?? {}), [body.supplier_id]: body.supplier_status }, order.items);
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ supplier_statuses: statuses, status: deriveOverallStatus(statuses, order.items) })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Legacy whole-order status update
  const update: Record<string, any> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabase
    .from('purchase_orders')
    .update(update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
