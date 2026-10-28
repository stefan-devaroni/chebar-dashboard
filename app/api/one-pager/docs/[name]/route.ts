import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { NO_ACCESS } from '@/lib/permissions';
import { docViewerHtml, DOCS_BUCKET, SANDBOXED_HEADERS, type ViewPage } from '@/lib/share-links';
import { docFile } from '@/lib/share-sections';

export const dynamic = 'force-dynamic';

// A One Pager document as owners see it: the same pages a buyer sees, without a name across them. Owners only (the
// middleware checks too). The One Pager opens it in a new tab, a top-level visit that carries the owner's login.
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  const file = docFile(params.name);
  const { data: blob } = file ? await createClient().storage.from(DOCS_BUCKET).download(file.pages) : { data: null };
  if (!file || !blob) return NextResponse.json({ error: 'No such document' }, { status: 404 });
  const { pages } = JSON.parse(await blob.text()) as { pages: ViewPage[] };
  const note = 'Owner preview: buyers see these pages with their own name across them, and can’t download or print them.';
  return new NextResponse(docViewerHtml({ title: file.label, pages, note }), { headers: SANDBOXED_HEADERS });
}
