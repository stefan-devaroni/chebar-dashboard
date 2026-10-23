import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { arubaNow } from '@/lib/reservations';
import { isPeriod } from '@/lib/sales';
import { loadSales } from '@/lib/sales-server';

// Sales tab (managers): one period's totals, comparison and product mix. ?period=thisWeek

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionInfo();
  if (session?.role !== 'manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const period = request.nextUrl.searchParams.get('period');
  if (!isPeriod(period)) return NextResponse.json({ error: 'Unknown period' }, { status: 400 });

  try {
    return NextResponse.json(await loadSales(createClient(), period, arubaNow().date));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load sales' }, { status: 500 });
  }
}
