import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';

// Owners switch a buyer link off or back on, unlock it after wrong passcodes, or move its last day.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// { action: 'off' | 'on' | 'unlock' } or { action: 'extend', expires: 'YYYY-MM-DD' }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return json({ error: NO_ACCESS }, 403);
  const body = await request.json().catch(() => ({}));
  let change: Record<string, unknown>;
  if (body.action === 'off') change = { revoked_at: new Date().toISOString() };
  else if (body.action === 'on') change = { revoked_at: null };
  else if (body.action === 'unlock') change = { failed_attempts: 0 };
  else if (body.action === 'extend' && typeof body.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expires)) {
    const expires = new Date(`${body.expires}T23:59:59-04:00`);
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    if (!(days > 0 && days <= 180)) return json({ error: 'Pick a last day in the next 6 months.' }, 400);
    change = { expires_at: expires.toISOString() };
  } else return json({ error: 'Unknown request' }, 400);

  const { error } = await createClient().from('share_links').update(change).eq('id', params.id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
