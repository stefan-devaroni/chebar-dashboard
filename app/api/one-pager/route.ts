import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { pointDocLinks } from '@/lib/share-sections';

export const dynamic = 'force-dynamic';

// The One Pager: the business summary for prospective buyers (Oct 2026), owners only (the middleware
// checks too). It's a finished HTML page stored in owner_documents (supabase/owner-documents.sql),
// served as a sandboxed document: its own script runs (section toggles, Print / save as PDF), but it
// gets its own origin, so it can't reach the dashboard's session or pages. For the same reason a click
// that loads something inside it arrives without the owner's login (Chrome counts it as another site's),
// so its document links open the viewer (docs/[name]/route.ts) in a new tab, a top-level visit that does.
export async function GET() {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });

  const { data, error } = await createClient()
    .from('owner_documents')
    .select('html')
    .eq('slug', 'one-pager')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'The one pager has not been uploaded yet' }, { status: 404 });

  return new NextResponse(pointDocLinks(data.html as string, '/api/one-pager/docs/', 'target="_blank" '), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "sandbox allow-scripts allow-modals allow-popups; default-src 'none'; style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
    },
  });
}
