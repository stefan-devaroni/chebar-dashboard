import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  const newItems: any[] = body.items;

  // Group new items by supplier
  const bySupplierId: Record<string, any[]> = {};
  for (const item of newItems) {
    const key = item.supplier_id ?? '__none__';
    if (!bySupplierId[key]) bySupplierId[key] = [];
    bySupplierId[key].push(item);
  }

  // Find the most recent draft order to merge into
  const { data: drafts } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1);

  const existingDraft = drafts?.[0];

  if (existingDraft) {
    const existingStatuses: Record<string, string> = existingDraft.supplier_statuses ?? {};
    const existingItems: any[] = existingDraft.items ?? [];

    const mergeItems: any[] = [];
    const overflowItems: any[] = [];

    for (const [supplierId, items] of Object.entries(bySupplierId)) {
      const supplierStatus = existingStatuses[supplierId];
      if (supplierStatus === 'sent' || supplierStatus === 'received') {
        // This supplier was already sent — overflow to a new order
        overflowItems.push(...items);
      } else {
        mergeItems.push(...items);
      }
    }

    // Merge compatible items into the existing draft
    if (mergeItems.length > 0) {
      const merged = [...existingItems];
      for (const newItem of mergeItems) {
        const existing = merged.find(
          (m) => m.name === newItem.name && m.supplier_id === newItem.supplier_id
        );
        if (existing) {
          existing.toBuy += newItem.toBuy;
        } else {
          merged.push(newItem);
        }
      }

      // Add draft status for any new suppliers
      const updatedStatuses = { ...existingStatuses };
      for (const item of mergeItems) {
        const key = item.supplier_id ?? '__none__';
        if (!updatedStatuses[key]) updatedStatuses[key] = 'draft';
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({ items: merged, supplier_statuses: updatedStatuses })
        .eq('id', existingDraft.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create a new order for overflow items (suppliers already sent)
    if (overflowItems.length > 0) {
      const overflowStatuses: Record<string, string> = {};
      for (const item of overflowItems) {
        overflowStatuses[item.supplier_id ?? '__none__'] = 'draft';
      }
      const { error } = await supabase
        .from('purchase_orders')
        .insert({
          items: overflowItems,
          status: 'draft',
          supplier_statuses: overflowStatuses,
        });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ merged: true, id: existingDraft.id });
  }

  // No existing draft — create a new order
  const supplierStatuses: Record<string, string> = {};
  for (const item of newItems) {
    supplierStatuses[item.supplier_id ?? '__none__'] = 'draft';
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      items: newItems,
      notes: body.notes || null,
      status: 'draft',
      supplier_statuses: supplierStatuses,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  // Per-supplier status update
  if (body.supplier_id !== undefined && body.supplier_status !== undefined) {
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', body.id)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const statuses: Record<string, string> = order.supplier_statuses ?? {};
    statuses[body.supplier_id] = body.supplier_status;

    // Ensure all suppliers in the order have a status entry
    const orderItems: any[] = order.items ?? [];
    const allSupplierIds = new Set(orderItems.map((i: any) => i.supplier_id ?? '__none__'));
    for (const sid of allSupplierIds) {
      if (!statuses[sid]) statuses[sid] = 'draft';
    }

    // Derive the overall order status from supplier statuses
    const allStatuses = Object.values(statuses);
    let overallStatus = 'draft';
    if (allStatuses.length > 0 && allStatuses.every((s) => s === 'received')) {
      overallStatus = 'received';
    } else if (allStatuses.every((s) => s === 'sent' || s === 'received')) {
      overallStatus = 'sent';
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ supplier_statuses: statuses, status: overallStatus })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Legacy whole-order status update
  const update: any = {};
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
