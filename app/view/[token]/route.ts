import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buyerHtml, checkPasscode, checkSession, CLOSED_TEXT, COOKIE, networkHash, passcodePage, SESSION_HOURS, signSession, type ShareLink } from '@/lib/share-links';
import { linkStatus, MAX_FAILED } from '@/lib/share-sections';

// A buyer's private link to the One Pager (Oct 2026): /view/<token>. Public on purpose (the middleware only
// guards /dashboard and /api); the token, the passcode and the link's state decide what someone sees.

export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
};
const FORM_HEADERS = {
  ...BASE_HEADERS,
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
// The summary runs as a sandboxed document: its own script works (motion), nothing else of the site is reachable
const DOC_HEADERS = {
  ...BASE_HEADERS,
  'Content-Security-Policy':
    "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'",
};

const page = (html: string, status = 200, headers: Record<string, string> = FORM_HEADERS) => new NextResponse(html, { status, headers });
const NOT_FOUND = 'This link doesn’t work. Ask Che Bar for a new one.';

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const supabase = createClient();
  const { data } = await supabase.from('share_links').select('*').eq('token', token).maybeSingle();
  if (!data) return null;
  const { count } = await supabase.from('share_link_views').select('id', { count: 'exact', head: true }).eq('link_id', data.id);
  return { link: data as ShareLink, views: count ?? 0 };
}

function clientIp(request: NextRequest): string {
  return request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const found = await load(params.token);
  if (!found) return page(passcodePage({ closed: NOT_FOUND }), 404);
  const { link, views } = found;
  const status = linkStatus(link, views);
  if (status !== 'active') return page(passcodePage({ closed: CLOSED_TEXT[status] }), 410);
  if (!checkSession(request.cookies.get(COOKIE)?.value, link.id, link.secret)) return page(passcodePage());

  const supabase = createClient();
  const { data: doc } = await supabase.from('owner_documents').select('html').eq('slug', link.doc_slug).maybeSingle();
  if (!doc) return page(passcodePage({ closed: 'The summary isn’t available right now. Please try again later.' }), 503);
  await supabase.from('share_link_views').insert({
    link_id: link.id,
    ip_hash: networkHash(clientIp(request), link.secret),
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return page(buyerHtml(doc.html as string, link, new Date()), 200, DOC_HEADERS);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const found = await load(params.token);
  if (!found) return page(passcodePage({ closed: NOT_FOUND }), 404);
  const { link, views } = found;
  const status = linkStatus(link, views);
  if (status !== 'active') return page(passcodePage({ closed: CLOSED_TEXT[status] }), 410);

  const form = await request.formData().catch(() => null);
  const passcode = String(form?.get('passcode') ?? '').slice(0, 40);
  const supabase = createClient();
  if (!passcode || !checkPasscode(passcode, link.passcode_hash)) {
    const failed = link.failed_attempts + 1;
    await supabase.from('share_links').update({ failed_attempts: failed }).eq('id', link.id);
    await new Promise((resolve) => setTimeout(resolve, 700)); // slows down guessing
    const left = MAX_FAILED - failed;
    return page(
      passcodePage(left > 0 ? { error: `That passcode isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` } : { closed: CLOSED_TEXT.locked }),
      401
    );
  }
  if (link.failed_attempts) await supabase.from('share_links').update({ failed_attempts: 0 }).eq('id', link.id);

  const response = NextResponse.redirect(new URL(`/view/${params.token}`, request.url), 303);
  response.cookies.set(COOKIE, signSession(link.id, link.secret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: `/view/${params.token}`,
    maxAge: SESSION_HOURS * 3600,
  });
  return response;
}
