import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();

  const { data: items, error: itemsError } = await supabase
    .from('inventory_items')
    .select('*, supplier:suppliers!inventory_items_supplier_id_fkey(id, name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(id, name)')
    .eq('active', true)
    .order('category')
    .order('name');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  return NextResponse.json({ items: items ?? [], suppliers: suppliers ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      name: body.name,
      category: body.category || 'other',
      unit: body.unit || 'each',
      unit_size: body.unit_size || null,
      par_stock: body.par_stock || 0,
      current_stock: body.current_stock || 0,
      supplier_id: body.supplier_id || null,
      backup_supplier_id: body.backup_supplier_id || null,
      notes: body.notes || null,
    })
    .select('*, supplier:suppliers!inventory_items_supplier_id_fkey(id, name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.category !== undefined) update.category = body.category;
  if (body.unit !== undefined) update.unit = body.unit;
  if (body.unit_size !== undefined) update.unit_size = body.unit_size || null;
  if (body.par_stock !== undefined) update.par_stock = body.par_stock;
  if (body.current_stock !== undefined) update.current_stock = body.current_stock;
  if (body.supplier_id !== undefined) update.supplier_id = body.supplier_id || null;
  if (body.backup_supplier_id !== undefined) update.backup_supplier_id = body.backup_supplier_id || null;
  if (body.notes !== undefined) update.notes = body.notes || null;
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabase
    .from('inventory_items')
    .update(update)
    .eq('id', body.id)
    .select('*, supplier:suppliers!inventory_items_supplier_id_fkey(id, name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
