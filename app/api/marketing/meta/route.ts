import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { syncMeta } from '@/lib/meta';

// Marketing tab (managers): read the latest Facebook + Instagram numbers from Meta now.
// The tab calls this when its data is more than 3 hours old; a daily function does the same.

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSessionInfo();
  if (session?.role !== 'manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  const summary = await syncMeta(createClient(), 'dashboard');
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 });
}
