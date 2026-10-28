import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { hashPasscode, newPasscode, newSecret, newToken } from '@/lib/share-links';
import { DEFAULT_HIDDEN, deviceName, isSectionKey, linkStatus } from '@/lib/share-sections';

// Owners make and list the private buyer links for the One Pager (owners only; the middleware checks too).
// The passcode is returned once, when a link is made, and only its hash is stored.

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const LINK_COLUMNS = 'id, token, recipient_name, recipient_company, recipient_email, hidden_sections, expires_at, max_views, failed_attempts, revoked_at, created_at, created_by';

export async function GET(request: NextRequest) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return json({ error: NO_ACCESS }, 403);
  const supabase = createClient();
  const [links, views] = await Promise.all([
    supabase.from('share_links').select(LINK_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('share_link_views').select('link_id, viewed_at, ip_hash, user_agent').order('viewed_at', { ascending: false }).limit(5000),
  ]);
  if (links.error) return json({ error: links.error.message }, 500);
  const origin = new URL(request.url).origin;
  const byLink = new Map<string, { viewed_at: string; ip_hash: string | null; user_agent: string | null }[]>();
  for (const v of views.data ?? []) byLink.set(v.link_id, [...(byLink.get(v.link_id) ?? []), v]);
  return json({
    links: (links.data ?? []).map(({ token, ...link }) => {
      const seen = byLink.get(link.id) ?? [];
      return {
        ...link,
        url: `${origin}/view/${token}`,
        status: linkStatus(link, seen.length),
        views: seen.length,
        last_viewed: seen[0]?.viewed_at ?? null,
        devices: new Set(seen.map((v) => v.ip_hash)).size,
        recent: seen.slice(0, 25).map((v) => ({ viewed_at: v.viewed_at, device: deviceName(v.user_agent) })),
      };
    }),
  });
}

// { name, company?, email?, expires: 'YYYY-MM-DD' (end of that day, Aruba time), max_views?, hidden?: section keys }
export async function POST(request: NextRequest) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return json({ error: NO_ACCESS }, 403);
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name, 80);
  if (!name) return json({ error: 'Type the person’s name.' }, 400);
  if (typeof body.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expires)) return json({ error: 'Pick the last day the link works.' }, 400);
  const expires = new Date(`${body.expires}T23:59:59-04:00`); // Aruba is UTC-4 all year
  const days = (expires.getTime() - Date.now()) / 86_400_000;
  if (!(days > 0)) return json({ error: 'The last day has to be in the future.' }, 400);
  if (days > 180) return json({ error: 'Pick a last day within 6 months.' }, 400);
  const maxViews = body.max_views === undefined || body.max_views === null || body.max_views === '' ? null : Math.floor(Number(body.max_views));
  if (maxViews !== null && !(maxViews >= 1 && maxViews <= 1000)) return json({ error: 'Openings must be a number from 1 to 1000, or empty.' }, 400);
  const hidden = Array.isArray(body.hidden) ? Array.from(new Set(body.hidden.filter(isSectionKey))) : DEFAULT_HIDDEN;

  const passcode = newPasscode();
  const token = newToken();
  const { data, error } = await createClient()
    .from('share_links')
    .insert({
      token,
      secret: newSecret(),
      recipient_name: name,
      recipient_company: clean(body.company, 80),
      recipient_email: clean(body.email, 120) || null,
      passcode_hash: hashPasscode(passcode),
      hidden_sections: hidden,
      expires_at: expires.toISOString(),
      max_views: maxViews,
      created_by: session.email,
    })
    .select('id, expires_at')
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ id: data.id, url: `${new URL(request.url).origin}/view/${token}`, passcode, expires_at: data.expires_at });
}
