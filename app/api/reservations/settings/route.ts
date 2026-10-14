import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { normalizeSettings } from '@/lib/reservations';
import { loadSettings } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { settings, error } = await loadSettings(createClient());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(settings);
}

// Managers only: online booking limits, and days closed to online booking
export async function PUT(request: NextRequest) {
  const session = await getSessionInfo();
  if (session?.role !== 'manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const supabase = createClient();
  const { settings: current, error: loadError } = await loadSettings(supabase);
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const next = normalizeSettings({ ...current, ...body });
  const { error } = await supabase
    .from('reservation_settings')
    .upsert({ id: 1, ...next, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(next);
}
