import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { DOCS_BUCKET } from '@/lib/share-links';
import { docFile } from '@/lib/share-sections';

export const dynamic = 'force-dynamic';

// A One Pager document as uploaded (private bucket one-pager-docs), for owners only (the middleware checks too).
// Buyers get theirs through /view/<token>/docs/<name>, with their name on every page.
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  const file = docFile(params.name);
  const { data: blob } = file ? await createClient().storage.from(DOCS_BUCKET).download(params.name) : { data: null };
  if (!file || !blob) return NextResponse.json({ error: 'No such document' }, { status: 404 });
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Che Bar - ${file.label}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
