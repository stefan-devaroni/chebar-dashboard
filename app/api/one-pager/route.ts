import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { DOCS_BUCKET } from '@/lib/share-links';
import { docFile } from '@/lib/share-sections';

export const dynamic = 'force-dynamic';

const SIGNED_HOURS = 12;

// The One Pager: the business summary for prospective buyers (Oct 2026), owners only (the middleware
// checks too). It's a finished HTML page stored in owner_documents (supabase/owner-documents.sql),
// served as a sandboxed document: its own script runs (section toggles, Print / save as PDF), but it
// gets its own origin, so it can't reach the dashboard's session or pages. For the same reason a click
// in it doesn't carry the owner's login (Chrome counts it as coming from another site), so its document
// links become signed download links from the private bucket, valid for 12 hours.
export async function GET() {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });

  const supabase = createClient();
  const { data, error } = await supabase.from('owner_documents').select('html').eq('slug', 'one-pager').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'The one pager has not been uploaded yet' }, { status: 404 });

  const html = data.html as string;
  const names = Array.from(new Set(Array.from(html.matchAll(/href="docs\/([^"]+)"/g), (m) => m[1])));
  const signed = new Map(
    await Promise.all(
      names.map(async (name) => {
        const file = docFile(name);
        const { data: link } = file
          ? await supabase.storage.from(DOCS_BUCKET).createSignedUrl(name, SIGNED_HOURS * 3600, { download: `Che Bar - ${file.label}.pdf` })
          : { data: null };
        return [name, link?.signedUrl ?? '#'] as const;
      })
    )
  );
  const page = html.replace(/href="docs\/([^"]+)"/g, (_, name: string) => `href="${(signed.get(name) ?? '#').replace(/&/g, '&amp;')}"`);

  return new NextResponse(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "sandbox allow-scripts allow-modals allow-popups allow-downloads; default-src 'none'; style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
    },
  });
}
