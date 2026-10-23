import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionWith } from '@/lib/roles';
import { NO_ACCESS } from '@/lib/permissions';
import { arubaNow } from '@/lib/reservations';
import { isPeriod } from '@/lib/sales';
import { loadSales } from '@/lib/sales-server';

// Sales tab (Sales access): one period's totals, comparison and product mix. ?period=thisWeek

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await sessionWith('sales'))) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });

  const period = request.nextUrl.searchParams.get('period');
  if (!isPeriod(period)) return NextResponse.json({ error: 'Unknown period' }, { status: 400 });

  try {
    return NextResponse.json(await loadSales(createClient(), period, arubaNow().date));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load sales' }, { status: 500 });
  }
}
