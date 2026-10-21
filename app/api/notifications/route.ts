import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { NOTIFICATION_COLUMNS } from '@/lib/notifications';

// The bell (managers): the latest notifications with the unread count, and marking them read.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function isManager() {
  const session = await getSessionInfo().catch(() => null);
  return session?.role === 'manager';
}

export async function GET() {
  if (!(await isManager())) return json({ error: 'Managers only' }, 403);
  const supabase = createClient();
  const [list, unread] = await Promise.all([
    supabase.from('notifications').select(NOTIFICATION_COLUMNS).order('created_at', { ascending: false }).limit(30),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  if (list.error) return json({ items: [], unread: 0 });
  return json({ items: list.data, unread: unread.count ?? 0 });
}

// { id } marks one read; { all: true } marks everything read
export async function PUT(request: NextRequest) {
  if (!(await isManager())) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  const supabase = createClient();
  const now = new Date().toISOString();
  const query = body.all ? supabase.from('notifications').update({ read_at: now }).is('read_at', null) : typeof body.id === 'string' ? supabase.from('notifications').update({ read_at: now }).eq('id', body.id) : null;
  if (!query) return json({ error: 'Unknown request' }, 400);
  const { error } = await query;
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
