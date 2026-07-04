import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, unit_size, par_stock, station, supplier:suppliers!inventory_items_supplier_id_fkey(name), backup_supplier:suppliers!inventory_items_backup_supplier_id_fkey(name)')
    .eq('active', true)
    .order('category')
    .order('name');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('name')
    .order('name');

  const supplierNames = (suppliers ?? []).map((s: any) => s.name).join(', ');

  const rows = [
    ['ID', 'Item Name', 'Category', 'Unit', 'Unit Size', 'Par', 'Station', 'Supplier', 'Backup Supplier', `Available suppliers: ${supplierNames}`].join(','),
  ];

  for (const item of items ?? []) {
    const i = item as any;
    rows.push([
      i.id,
      csvEscape(i.name),
      i.category,
      i.unit,
      csvEscape(i.unit_size || ''),
      i.par_stock,
      i.station,
      csvEscape(i.supplier?.name || ''),
      csvEscape(i.backup_supplier?.name || ''),
      '',
    ].join(','));
  }

  const csv = rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="che-bar-inventory.csv"',
    },
  });
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
