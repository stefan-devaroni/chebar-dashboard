import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { hashPasscode, linkUrl, newPasscode, openPasscode, sealPasscode } from '@/lib/share-links';
import { isSectionKey } from '@/lib/share-sections';

// One buyer link, for owners: its address and passcode to copy again (GET), or a change (PATCH): switch it off or
// back on, unlock it after wrong passcodes, move its last day, change what it shows or how often it may be opened,
// or give it a new passcode.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// { id, url, passcode (null when the link was made before passcodes were kept, Oct 28 2026), expires_at }
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return json({ error: NO_ACCESS }, 403);
  const { data, error } = await createClient()
    .from('share_links')
    .select('id, token, passcode_enc, expires_at')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'No such link' }, 404);
  return json({ id: data.id, url: linkUrl(request, data.token), passcode: openPasscode(data.passcode_enc), expires_at: data.expires_at });
}

// { action: 'off' | 'on' | 'unlock' | 'passcode' }, { action: 'extend', expires: 'YYYY-MM-DD' },
// { action: 'sections', hidden: section keys } or { action: 'max_views', max_views: 1–1000 or null for no limit }.
// A new passcode replaces the old one (which stops working) and comes back. A used-up link works again once its
// limit is above its openings.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return json({ error: NO_ACCESS }, 403);
  const body = await request.json().catch(() => ({}));
  let change: Record<string, unknown>;
  let passcode: string | undefined;
  if (body.action === 'off') change = { revoked_at: new Date().toISOString() };
  else if (body.action === 'on') change = { revoked_at: null };
  else if (body.action === 'unlock') change = { failed_attempts: 0 };
  else if (body.action === 'passcode') {
    passcode = newPasscode();
    change = { passcode_hash: hashPasscode(passcode), passcode_enc: sealPasscode(passcode), failed_attempts: 0 };
  } else if (body.action === 'sections' && Array.isArray(body.hidden)) change = { hidden_sections: Array.from(new Set(body.hidden.filter(isSectionKey))) };
  else if (body.action === 'max_views') {
    const max = body.max_views ?? null;
    if (max !== null && !(Number.isInteger(max) && max >= 1 && max <= 1000)) return json({ error: 'Openings must be a number from 1 to 1000, or empty.' }, 400);
    change = { max_views: max };
  }
  else if (body.action === 'extend' && typeof body.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expires)) {
    const expires = new Date(`${body.expires}T23:59:59-04:00`);
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    if (!(days > 0 && days <= 180)) return json({ error: 'Pick a last day in the next 6 months.' }, 400);
    change = { expires_at: expires.toISOString() };
  } else return json({ error: 'Unknown request' }, 400);

  const { error } = await createClient().from('share_links').update(change).eq('id', params.id);
  return error ? json({ error: error.message }, 500) : json(passcode ? { ok: true, passcode } : { ok: true });
}
