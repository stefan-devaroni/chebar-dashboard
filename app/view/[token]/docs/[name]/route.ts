import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkSession, clientIp, COOKIE, docViewerHtml, DOCS_BUCKET, loadLink, markText, networkHash, SANDBOXED_HEADERS, type ViewPage,
} from '@/lib/share-links';
import { docFile, linkStatus } from '@/lib/share-sections';

// A document from the One Pager's Documents section, through one buyer's link (Oct 2026): only with that link's
// passcode cookie, only while the link works, and only from groups the link shows. It opens as pages to look at,
// with the person's name across them (Stefan: view, not download), and every look is logged with the openings
// (share_link_views.file).

export const dynamic = 'force-dynamic';

const message = (text: string, status: number) =>
  new NextResponse(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });

export async function GET(request: NextRequest, { params }: { params: { token: string; name: string } }) {
  const file = docFile(params.name);
  const found = file ? await loadLink(params.token) : null;
  if (!file || !found) return message('This document isn’t available.', 404);
  const { link, views } = found;
  if (linkStatus(link, views) !== 'active') return message('This link no longer works. Ask Che Bar for a new one.', 410);
  // Without the cookie (or after 12 hours): back to the passcode page
  if (!checkSession(request.cookies.get(COOKIE)?.value, link.id, link.secret)) {
    return new NextResponse(null, { status: 303, headers: { Location: `/view/${params.token}`, 'Cache-Control': 'no-store' } });
  }
  if (link.hidden_sections.includes(file.key)) return message('This document isn’t available.', 404);

  const supabase = createClient();
  const { data: blob } = await supabase.storage.from(DOCS_BUCKET).download(file.pages);
  if (!blob) return message('This document isn’t available.', 404);
  let pages: ViewPage[];
  try {
    pages = (JSON.parse(await blob.text()) as { pages: ViewPage[] }).pages;
  } catch {
    return message('This document couldn’t be opened. Please let Che Bar know.', 500);
  }
  const now = new Date();
  await supabase.from('share_link_views').insert({
    link_id: link.id,
    viewed_at: now.toISOString(),
    ip_hash: networkHash(clientIp(request), link.secret),
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    file: params.name,
  });
  return new NextResponse(docViewerHtml({ title: file.label, pages, back: `/view/${params.token}`, text: markText(link, now) }), {
    headers: SANDBOXED_HEADERS,
  });
}
