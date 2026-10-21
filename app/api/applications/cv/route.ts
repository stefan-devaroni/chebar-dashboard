import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';

// Opens an applicant's CV (managers): a signed link that works for 5 minutes, so CVs never sit at a public address.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionInfo();
  if (session?.role !== 'manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createClient();
  const { data } = await supabase.from('job_applications').select('cv_path').eq('id', id).maybeSingle();
  if (!data?.cv_path) return NextResponse.json({ error: 'No CV for this applicant' }, { status: 404 });

  const { data: signed, error } = await supabase.storage.from('applications').createSignedUrl(data.cv_path, 300);
  if (error || !signed) return NextResponse.json({ error: 'Could not open the CV' }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
