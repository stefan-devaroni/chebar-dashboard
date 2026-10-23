import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionWith } from '@/lib/roles';
import { can, NO_ACCESS, type Permission } from '@/lib/permissions';
import { NOTIFICATION_COLUMNS, type NotificationKind } from '@/lib/notifications';

// The bell (Applicants access): the latest notifications with the unread count, and marking them
// read. Each person only gets the kinds that belong to parts of the dashboard they can open.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

const KIND_ACCESS: Record<NotificationKind, Permission> = {
  application: 'applicants',
  reservation: 'reservations',
  delivery: 'purchasing',
};

// null: every kind (also any older kinds not listed above)
function visibleKinds(perms: readonly string[]): string[] | null {
  const kinds = Object.entries(KIND_ACCESS).filter(([, perm]) => can(perms, perm)).map(([kind]) => kind);
  return kinds.length === Object.keys(KIND_ACCESS).length ? null : kinds;
}

export async function GET() {
  const session = await sessionWith('applicants');
  if (!session) return json({ error: NO_ACCESS }, 403);
  const kinds = visibleKinds(session.perms);
  const supabase = createClient();
  let list = supabase.from('notifications').select(NOTIFICATION_COLUMNS).order('created_at', { ascending: false }).limit(30);
  let unread = supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (kinds) {
    list = list.in('kind', kinds);
    unread = unread.in('kind', kinds);
  }
  const [items, count] = await Promise.all([list, unread]);
  if (items.error) return json({ items: [], unread: 0 });
  return json({ items: items.data, unread: count.count ?? 0 });
}

// { id } marks one read; { all: true } marks everything read
export async function PUT(request: NextRequest) {
  const session = await sessionWith('applicants');
  if (!session) return json({ error: NO_ACCESS }, 403);
  const kinds = visibleKinds(session.perms);
  const body = await request.json().catch(() => ({}));
  const supabase = createClient();
  const now = new Date().toISOString();
  let query = body.all ? supabase.from('notifications').update({ read_at: now }).is('read_at', null) : typeof body.id === 'string' ? supabase.from('notifications').update({ read_at: now }).eq('id', body.id) : null;
  if (!query) return json({ error: 'Unknown request' }, 400);
  if (kinds) query = query.in('kind', kinds);
  const { error } = await query;
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
