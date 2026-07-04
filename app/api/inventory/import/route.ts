import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();
  const rows: { id: string; supplier: string; backup_supplier: string; station: string }[] = body.rows;

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name');

  const supplierMap = new Map<string, string>();
  for (const s of suppliers ?? []) {
    supplierMap.set(s.name.toLowerCase().trim(), s.id);
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.id) { skipped++; continue; }

    const update: any = {};

    if (row.supplier !== undefined) {
      const key = row.supplier.toLowerCase().trim();
      if (key === '') {
        update.supplier_id = null;
      } else if (supplierMap.has(key)) {
        update.supplier_id = supplierMap.get(key);
      } else {
        errors.push(`Unknown supplier "${row.supplier}" for item ${row.id}`);
        continue;
      }
    }

    if (row.backup_supplier !== undefined) {
      const key = row.backup_supplier.toLowerCase().trim();
      if (key === '') {
        update.backup_supplier_id = null;
      } else if (supplierMap.has(key)) {
        update.backup_supplier_id = supplierMap.get(key);
      } else {
        errors.push(`Unknown backup supplier "${row.backup_supplier}" for item ${row.id}`);
        continue;
      }
    }

    if (row.station !== undefined) {
      const station = row.station.toLowerCase().trim();
      if (['bar', 'kitchen', 'both'].includes(station)) {
        update.station = station;
      }
    }

    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from('inventory_items')
        .update(update)
        .eq('id', row.id);

      if (error) {
        errors.push(`Failed to update ${row.id}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ updated, skipped, errors });
}
