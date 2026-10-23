import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionWith } from '@/lib/roles';
import { NO_ACCESS } from '@/lib/permissions';
import { syncMeta } from '@/lib/meta';

// Marketing tab (Marketing access): read the latest Facebook + Instagram numbers from Meta now.
// The tab calls this when its data is more than 3 hours old; a daily function does the same.

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!(await sessionWith('marketing'))) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  const summary = await syncMeta(createClient(), 'dashboard');
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 });
}
