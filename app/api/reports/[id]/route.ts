import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: ingestion, error: fetchError } = await supabase
    .from('report_ingestions')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !ingestion) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (ingestion.report_type === 'daily_sales' && ingestion.status === 'processed' && ingestion.raw_data) {
    const dates = extractDates(ingestion.raw_data);
    if (dates.length > 0) {
      await supabase
        .from('daily_metrics')
        .delete()
        .in('date', dates);
    }
  }

  const { error: deleteError } = await supabase
    .from('report_ingestions')
    .delete()
    .eq('id', params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'deleted', dates_removed: ingestion.report_type === 'daily_sales' });
}

function extractDates(rawData: string): string[] {
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const matches = rawData.match(datePattern);
  if (!matches) return [];
  return [...new Set(matches)].filter((d) => {
    const year = parseInt(d.slice(0, 4));
    return year >= 2020 && year <= 2030;
  });
}
